
all: generateImagesTotalBytes

generateImagesTotalBytes:
	@echo IMAGES_TOTAL_BYTES=`cat images/* | wc -c` > javascripts/imagesTotalBytes.js

.PHONY: generateImagesTotalBytes
