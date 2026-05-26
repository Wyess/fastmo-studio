CC = emcc
SRC_DIR = src
DIST_DIR = dist

SRCS = $(SRC_DIR)/sonic.c

TARGET = $(DIST_DIR)/sonic.js

EXPORTED_FUNCTIONS = "_sonicCreateStream", "_sonicDestroyStream", "_sonicWriteFloatToStream", "_sonicReadFloatFromStream", "_sonicReadShortFromStream", "_sonicSetSpeed", "_sonicFlushStream", "_memset", "_malloc", "_free"

CFLAGS = \
		-s EXPORTED_FUNCTIONS='[$(EXPORTED_FUNCTIONS)]' \
		-s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "HEAPF32", "HEAP16"]' \
		-s ENVIRONMENT='web' \
		-s ALLOW_MEMORY_GROWTH=1 \
		-O3

all: $(TARGET)

$(TARGET): $(SRCS) | $(DIST_DIR)
	$(CC) $(SRCS) -o $(TARGET) $(CFLAGS)

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

clean:
	rm -rf $(DIST_DIR)

.PHONY: all clean

