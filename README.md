# Fastmo Studio — Fast audio in your pocket

![PWA Supported](https://img.shields.io/badge/PWA-Ready-blue.svg)
![Wasm Speed](https://img.shields.io/badge/WebAssembly-Sonic-orange.svg)
![Language](https://img.shields.io/badge/Language-JA%20%7C%20EN-green.svg)

## Features
### 1. High-quality time stretching
Fastmo Studio is a web application that enables you to speed up audio files without changing their pitch (time stretching). Armed with fast and high quality audio processing powered by Sonic library by Bill Cox, it is best suited for learning languages, quickly reviewing long seminar sessions, catching up on podcasts, etc.

### 2. Multi-speed conversion
In addition to single-speed conversion, you can use multi-speed conversion, in which the converted audio includes the same track repeated with multiple speeds in sequence. e.g. 2x, 3x, 4x, and then 1x.
This sequence leverages the "contrast effect" of human audio perception.  By exposure to ultra-fast speeds (e.g., 4x) first, the subsequent 1x standard speed will feel incredibly slow and much easier to comprehend—perfect for deep language training and audio parsing.

### 3. Offline-ready (PWA)
You can use Fastmo Studio offline by installing it like a native app: on board, in a cave, on a mountain, under the sea,... as long as your smartphone is functional.

### 4. Internationalization (i18n)
Originally written in Japanese, Fastmo Studio now supports seamless UI language switching between Japanese and English. Adding new languages is straightforward, as the localization data is completely decoupled from the core HTML and JavaScript logic.

## How to use Fastmo Studio
### 1. Select speed preset
### 2. Select output format
AAC or WAV: Note that AAC is not supported on some platforms such as Linux, in which case the AAC button is disabled.
### 3. Select input audio file(s)
### 4. Press convert button
### 5. Conversion completed! You can now:
- Download: Press download button to download a single audio file or a ZIP archive containing all the converted files.
- Play: Press ▶ button on the audio player at the bottom to quickly take a listen to the converted audio files sequentially.


## Behind the Name "Fastmo Studio"
The name is a multi-layered hybrid tribute to speed and ubiquity:
1. Inspired by the legendary violinist [Shlomo Mintz ](https://youtu.be/amfCqFUMBkY?si=NhdVjD5S5NJLP1Oz)— turning "Slo-mo" into "Fastmo" with virtuosic audio processing.

2. Nodding to [John Moschitta Jr.](https://youtu.be/4X4Fy8YqysY?si=VJXGx2ZNX-kNae0d), the world's fastest-talking man (the "mo" in Fastmo).

3. In Japanese, "Fastmo" sounds like "Tomo", meaning "Always by your side" or "A friend" — representing its ubiquitous web-nature that runs anywhere, on any OS/Device

## Local Development

1. Clone this repository:
```bash
   git clone https://github.com/Wyess/fastmo-studio.git
   cd fastmo-studio
   ```

2. Start a local static server (e.g., using Python, Node.js, etc.):
### Example using Python
```bash
    python3 -m http.server 8080
    ```

3. Open http://localhost:8080 in your browser.

## Tech Stack
* **Core:** JavaScript (Vanilla JS), HTML5, CSS3
* **Audio Engine:** WebCodecs API (AAC Encoding) / Web Audio API
* **Audio Processing:** WebAssembly (Wasm) compiled Sonic algorithm (Time-stretching)
* **PWA:** Service Worker / Web App Manifest

## ❤️ Support the Project

If Fastmo Studio helps you save time, consider buying me a coffee! (Or a bottle of milk for my kid?)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-blue.svg)](https://buymeacoffee.com/wyess)
