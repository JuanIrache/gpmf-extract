# GPMF extract

Finds the metadata track in GoPro (Hero5 and later) video files (or any other camera that implements GPMF) and extracts it for later analysis and processing.

Accepts a File and returns a Promise that resolves to an object with a Buffer (rawData) and timing data (timing), useful for interpreting the data.

Once extracted, you can process the data with [gopro-telemetry](https://github.com/JuanIrache/gopro-telemetry).

Install:

```shell
$ npm i gpmf-extract
```

Use:

```js
const gpmfExtract = require('gpmf-extract');
gpmfExtract(file).then(res => {
  console.log('Length of data received:', res.rawData.length);
  console.log('Framerate of data received:', 1 / res.timing.frameDuration);
  // Do what you want with the data
});
```

If using it in the browser, you must specify it in the second argument. Optionally, you can also pass a second argument with a function to run when the processed percentage updates.

```js
const gpmfExtract = require('gpmf-extract');
const progress = percent => console.log(`${percent}% processed`);
gpmfExtract(file, true, progress).then(res => {
  // Do what you want with the data
});
```

This code was created for the [GoPro Telemetry Extractor](https://goprotelemetryextractor.com/free).

Here's a [gallery with cool uses of the GoPro telemetry](https://goprotelemetryextractor.com/gallery).

This project is possible thanks to the [gpmf-parser documentation](https://github.com/gopro/gpmf-parser), open sourced by GoPro.

## More creative coding

If you liked this you might like some of my [app prototyping](https://prototyping.barcelona).

## Contribution

Please make your changes to the **dev** branch, so that automated tests can be run before merging to **master**. Also, if possible, provide tests for new functionality.

## To-DO

- Unduplicate code from readBlock and readBlockWorker
- Increase browser compatibility
- Ideas for handling large files in Node?
  - (maybe trimming the video in chunks multiple of 1.001Hz) https://github.com/gopro/gpmf-parser/issues/37
  - Using streams didn't work so far: https://github.com/gpac/mp4box.js/issues/181
- Extract highlights

## Handling large file.

Please increase the chunk size according to the video file size,
until the fix for the following mp4box is merged.
https://github.com/gpac/mp4box.js/issues/205

You can call with the path to large file and specify the size of chunk to load.
More larger the video file is, more larger you should specify the size of chunk.

Please refer to `code/index.test.js`

```js
const res = await gpmfExtract(bufferAppender(largeFilePath, 10 * 1024 * 1024));

function bufferAppender(path, chunkSize) {
  return function(mp4boxFile) {
    var stream = fs.createReadStream(path, {'highWaterMark': chunkSize});
    var bytesRead = 0;
    stream.on('end', () => {
      mp4boxFile.flush();
    });
    stream.on('data', (chunk) => {
      var arrayBuffer = new Uint8Array(chunk).buffer;
      arrayBuffer.fileStart = bytesRead;
      mp4boxFile.appendBuffer(arrayBuffer);
      bytesRead += chunk.length;
    });
    stream.resume();
  }
}
```

## Acknowledgements/credits

- [Juan Irache](https://github.com/JuanIrache) - Main developer
- [Jonas Wagner](https://github.com/jwagner) - Contributor
- [Thomas Sarlandie](https://github.com/sarfata) - Contributor
