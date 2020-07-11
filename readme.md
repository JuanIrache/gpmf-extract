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

## Acknowledgements/credits

- [Juan Irache](https://github.com/JuanIrache) - Main developer
- [Jonas Wagner](https://github.com/jwagner) - Contributor
- [Thomas Sarlandie](https://github.com/sarfata) - Contributor
