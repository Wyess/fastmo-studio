import * as mm from 'https://cdn.jsdelivr.net/npm/music-metadata-browser@2.5.9/+esm';

const presetMatrices = {
    '2_3_4_1': [2.0, 3.0, 4.0, 1.0],
    '1_2_3_4_1': [1.0, 2.0, 3.0, 4.0, 1.0],
    '2.0': [2.0],
    '3.0': [3.0],
    '4.0': [4.0]
};

let playlist = [];
let currentTrackIndex = 0;
let finalDownloadBlob = null;
let finalDownloadName = "";
let isProcessed = false;

const player = document.getElementById('mainPlayer');
const processBtn = document.getElementById('processBtn');
const fileInput = document.getElementById('audioFiles');
const presetSelect = document.getElementById('presetSelect');
const statusText = document.getElementById('status');

// 💡 設定変更時のリセット関数を安全に定義
function resetProcessState() {
    if (!isProcessed) return; // 既に未変換状態なら何もしない
    isProcessed = false;
    finalDownloadBlob = null;
    processBtn.innerText = "一括変換スタート";
    processBtn.classList.remove('ready-to-download');
    statusText.innerText = "設定が変更されました。変換ボタンを押してください。";
    statusText.style.color = "var(--accent)";
}

// 💡 ロード完了ハンドラー（すべてのセットアップを安全にここで実行）
window.Module = window.Module || {};
window.Module.onRuntimeInitialized = () => {
    statusText.innerText = '準備完了。システムを使用できます。';
    processBtn.disabled = false;

    // WASM初期化が確実に終わった段階で、各種イベントリスナーを安全にバインド
    fileInput.removeEventListener('change', resetProcessState);
    fileInput.addEventListener('change', resetProcessState);
    
    presetSelect.removeEventListener('change', resetProcessState);
    presetSelect.addEventListener('change', resetProcessState);
    
    document.querySelectorAll('input[name="outFormat"]').forEach(el => {
        el.removeEventListener('change', resetProcessState);
        el.addEventListener('change', resetProcessState);
    });
};

// 保険：すでにWASMロードが完了している場合の即時発火
if (window.Module && window.Module._sonicCreateStream) {
    window.Module.onRuntimeInitialized();
}

processBtn.addEventListener('click', async () => {
    if (isProcessed && finalDownloadBlob) {
        const dlLink = document.createElement('a');
        dlLink.href = URL.createObjectURL(finalDownloadBlob);
        dlLink.download = finalDownloadName;
        document.body.appendChild(dlLink);
        dlLink.click();
        document.body.removeChild(dlLink);
        return;
    }

    if (!fileInput.files.length) return alert('ファイルを選択してください');

    const selectedPreset = presetSelect.value;
    const presetLabel = presetSelect.options[presetSelect.selectedIndex].dataset.label;
    const speeds = presetMatrices[selectedPreset];
    const format = document.querySelector('input[name="outFormat"]:checked').value;

    toggleUiLock(true);
    statusText.innerText = '一括処理セッションを開始しました...';
    
    const zip = new JSZip();
    const files = Array.from(fileInput.files);
    playlist = [];
    let lastOutputBlob = null;
    let lastOutputName = "";
    
    let ext = (format === 'aac') ? 'aac' : 'wav';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        statusText.innerText = `処理中 (${i + 1}/${files.length}): ${file.name}`;

        let originalSampleRate = 44100;
        try {
            const metadata = await mm.parseBlob(file);
            if (metadata && metadata.format && metadata.format.sampleRate) {
                originalSampleRate = metadata.format.sampleRate;
            }
        } catch (e) {
            console.error("Metadata fallback:", e);
        }

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: originalSampleRate });
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const numInputFrames = audioBuffer.length;

        const interleavedInput = new Float32Array(numInputFrames * numChannels);
        if (numChannels === 2) {
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            for (let j = 0; j < numInputFrames; j++) {
                interleavedInput[j * 2]     = left[j];
                interleavedInput[j * 2 + 1] = right[j];
            }
        } else {
            interleavedInput.set(audioBuffer.getChannelData(0));
        }

        const bytesPerFloat = 4;
        const inputPtr = Module._malloc(interleavedInput.length * bytesPerFloat);
        Module.HEAPF32.set(interleavedInput, inputPtr / bytesPerFloat);

        const bytesPerShort = 2;
        const maxMergedSamples = interleavedInput.length * 5 + (sampleRate * numChannels * 4 * speeds.length);
        const mergedOutputPtr = Module._malloc(maxMergedSamples * bytesPerShort);
        let mergedOffsetSamples = 0;

        for (let speed of speeds) {
            const stream = Module._sonicCreateStream(sampleRate, numChannels);
            Module._sonicSetSpeed(stream, speed);
            Module._sonicWriteFloatToStream(stream, inputPtr, numInputFrames);
            Module._sonicFlushStream(stream);

            let maxReadFrames = Math.floor((maxMergedSamples - mergedOffsetSamples) / numChannels);
            while (maxReadFrames > 0) {
                const currentWritePtr = mergedOutputPtr + (mergedOffsetSamples * bytesPerShort);
                const numOutputFrames = Module._sonicReadShortFromStream(stream, currentWritePtr, maxReadFrames);
                if (numOutputFrames <= 0) break;
                
                mergedOffsetSamples += numOutputFrames * numChannels;
                maxReadFrames = Math.floor((maxMergedSamples - mergedOffsetSamples) / numChannels);
            }

            if (speeds.length > 1) {
                const silenceSamples = Math.floor(sampleRate * 0.5) * numChannels;
                if (mergedOffsetSamples + silenceSamples < maxMergedSamples) {
                    const silenceWritePtr = mergedOutputPtr + (mergedOffsetSamples * bytesPerShort);
                    Module._memset(silenceWritePtr, 0, silenceSamples * bytesPerShort);
                    mergedOffsetSamples += silenceSamples;
                }
            }
            Module._sonicDestroyStream(stream);
        }

        Module._free(inputPtr);

        const finalPcmSamples = new Int16Array(Module.HEAP16.buffer, mergedOutputPtr, mergedOffsetSamples);
        
        let outputBlob;

        if (format === 'aac') {
            statusText.innerText = `AAC圧縮中 (${i + 1}/${files.length}): ${file.name}`;
            outputBlob = await encodePcmToPureAAC(finalPcmSamples, sampleRate, numChannels);
        } else {
            statusText.innerText = `WAVヘッダー生成中 (${i + 1}/${files.length}): ${file.name}`;
            const wavBuffer = createWavFileBuffer(finalPcmSamples, sampleRate, numChannels);
            outputBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        }

        Module._free(mergedOutputPtr);

        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const outFileName = `${baseName}_${presetLabel}.${ext}`;
        
        lastOutputBlob = outputBlob;
        lastOutputName = outFileName;

        if (files.length > 1) {
            zip.file(outFileName, outputBlob);
        }

        playlist.push({
            name: outFileName,
            url: URL.createObjectURL(outputBlob)
        });
    }

    if (files.length === 1) {
        finalDownloadBlob = lastOutputBlob;
        finalDownloadName = lastOutputName;
    } else {
        statusText.innerText = 'ZIP圧縮アーカイブを作成中...';
        finalDownloadBlob = await zip.generateAsync({ type: 'blob' });
        finalDownloadName = `sonic_processed_${format}.zip`;
    }

    isProcessed = true;
    toggleUiLock(false);

    statusText.innerText = `変換完了！下のプレイヤーで今すぐ聴けます。保存する場合はもう一度ボタンを押してください。`;
    statusText.style.color = 'var(--success)';

    processBtn.innerText = files.length === 1 ? `🟢 ${ext.toUpperCase()}ファイルを出力` : `🟢 ZIPファイルをダウンロード`;
    processBtn.classList.add('ready-to-download');

    if (playlist.length > 0) {
        document.getElementById('playerPanel').style.display = 'block';
        playTrack(0);
    }
});

function toggleUiLock(disabled) {
    fileInput.disabled = disabled;
    presetSelect.disabled = disabled;
    document.querySelectorAll('input[name="outFormat"]').forEach(el => el.disabled = disabled);
    if (disabled) {
        processBtn.disabled = true;
        processBtn.innerText = "処理中...";
    } else {
        processBtn.disabled = false;
    }
}

function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentTrackIndex = index;
    const track = playlist[index];
    
    document.getElementById('trackInfo').innerText = `${index + 1}/${playlist.length}: ${track.name}`;
    player.src = track.url;
    player.playbackRate = 1.0; 
    //player.play();
}

player.addEventListener('ratechange', () => {
    if (player.playbackRate !== 1.0) {
        player.playbackRate = 1.0;
    }
});

player.addEventListener('ended', () => {
    if (currentTrackIndex + 1 < playlist.length) {
        // 次のトラックをセット
        playTrack(currentTrackIndex + 1);
        // 2曲目以降の連続再生時は、ユーザーが一度再生を始めているので自動再生してOK
        document.getElementById('trackInfo').innerText = `再生中 (${currentTrackIndex + 1}/${playlist.length}): ${playlist[currentTrackIndex].name}`;
        player.play();
    }
});


function encodePcmToPureAAC(pcmInt16Array, sampleRate, numChannels) {
    return new Promise((resolve, reject) => {
        try {
            const chunks = [];
            const sampleRateTable = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
            let freqIndex = sampleRateTable.indexOf(sampleRate);
            if (freqIndex === -1) freqIndex = 4;

            const encoder = new AudioEncoder({
                output: (chunk) => {
                    const rawBuffer = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(rawBuffer);

                    const adtsHeader = new Uint8Array(7);
                    const totalPacketLen = chunk.byteLength + 7;

                    adtsHeader[0] = 0xFF;
                    adtsHeader[1] = 0xF1;
                    adtsHeader[2] = 0x40 | (freqIndex << 2) | (numChannels >> 2);
                    adtsHeader[3] = ((numChannels & 3) << 6) | (totalPacketLen >> 11);
                    adtsHeader[4] = (totalPacketLen & 0x7FF) >> 3;
                    adtsHeader[5] = ((totalPacketLen & 7) << 5) | 0x1F;
                    adtsHeader[6] = 0xFC;

                    chunks.push(adtsHeader, rawBuffer);
                },
                error: (e) => reject(e)
            });

            encoder.configure({
                codec: 'mp4a.40.2',
                sampleRate: sampleRate,
                numberOfChannels: numChannels,
                bitrate: 128000
            });

            const totalFrames = pcmInt16Array.length / numChannels;

            const audioData = new AudioData({
                format: 's16',
                sampleRate: sampleRate,
                numberOfFrames: totalFrames,
                numberOfChannels: numChannels,
                timestamp: 0,
                data: pcmInt16Array
            });

            encoder.encode(audioData);
            audioData.close();

            encoder.flush().then(() => {
                encoder.close();
                resolve(new Blob(chunks, { type: 'audio/aac' }));
            }).catch(reject);

        } catch (err) {
            reject(err);
        }
    });
}

function createWavFileBuffer(pcmInt16Array, sampleRate, numChannels) {
    const buffer = new ArrayBuffer(44 + pcmInt16Array.byteLength);
    const view = new DataView(buffer);

    function writeString(offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmInt16Array.byteLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); 
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); 
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true); 
    writeString(36, 'data');
    view.setUint32(40, pcmInt16Array.byteLength, true);

    const headerBytes = new Uint8Array(buffer, 44);
    headerBytes.set(new Uint8Array(pcmInt16Array.buffer, pcmInt16Array.byteOffset, pcmInt16Array.byteLength));

    return buffer;
}

// 言語を切り替えるメイン関数
async function applyLanguage(lang) {
  try {
    // 1. 指定された言語のJSONをフェッチ
    const response = await fetch(`./lang/${lang}.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const translations = await response.json();

    // 2. [data-i18n] 属性を持つ要素をすべて書き換え
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (translations[key]) {
        // ボタンやラベルのテキストを書き換え
        element.textContent = translations[key];
      }
    });

    // 3. ユーザーの選択をブラウザに記憶させる
    localStorage.setItem('fastmo-lang', lang);
  } catch (error) {
    console.error('Failed to load language file:', error);
  }
}

// ページ読み込み時の初期化処理
document.addEventListener('DOMContentLoaded', () => {
  // ブラウザが記憶している言語があればそれを使い、なければデフォルトを英語（en）にする
  const initialLang = localStorage.getItem('fastmo-lang') || 'en';
  applyLanguage(initialLang);

  // ボタンのクリックイベントを紐付け
  document.getElementById('btn-lang-en').addEventListener('click', () => applyLanguage('en'));
  document.getElementById('btn-lang-ja').addEventListener('click', () => applyLanguage('ja'));
});

