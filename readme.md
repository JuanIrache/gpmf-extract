# GPMF extract

Finds the metadata track in GoPro (Hero5 and later) video files (or any other camera that implements GPMF) and extracts it for later analysis and processing.

Accepts a File and returns a Promise that resolves to an object with a rawData (`Buffer` in NodeJS, `UInt8Array` in Browser) and timing data (timing), useful for interpreting the data.

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

You can specify some options in an object as a second argument:

- **browserMode**: Default: _false_. Change behaviour to use in browser. This is optional for debugging reasons
- **useWorker**: Default: _true_. In browser mode, use a web worker to avoid locking the browser. This is optional as it seems to crash on some recent browsers
- **progress**: Pass a function to read the processed percentage updates
- **cancellationToken**: An optional object, containing a cancelled property, that allows for cancelling the extraction process. Currently only supported in browser mode. If cancelled, the extraction process will fail with the error message "Canceled by user".

```js
const gpmfExtract = require('gpmf-extract');
const progress = percent => console.log(`${percent}% processed`);
const cancellationToken = { cancelled: false };
gpmfExtract(file, { browserMode: true, progress, cancellationToken }).then(
  res => {
    if (!res) return; //cancelled
    // Do what you want with the data
  }
);
// Some other processes
cancellationToken.cancelled = true;
```

## About

This code was created for the [GoPro Telemetry Extractor](https://goprotelemetryextractor.com/free).

Here's a [gallery with cool uses of the GoPro telemetry](https://goprotelemetryextractor.com/gallery).

This project is possible thanks to the [gpmf-parser documentation](https://github.com/gopro/gpmf-parser), open sourced by GoPro.

## More creative coding

If you liked this you might like some of my [app prototyping](https://prototyping.barcelona).

## Contribution

Please make your changes to the **dev** branch, so that automated tests can be run before merging to **master**. Also, if possible, provide tests for new functionality.

## To-DO

- Fix #46 Memory allocation with large files on certain browsers when using the web worker option
- Increase browser compatibility
- Extract highlights

## Acknowledgements/credits

- [Juan Irache](https://github.com/JuanIrache) - Main developer
- [Jonas Wagner](https://github.com/jwagner) - Contributor
- [Thomas Sarlandie](https://github.com/sarfata) - Contributor
- [Motoyasu Yamada](https://github.com/motoyasu-yamada) - Contributor
- [HugoPoi](https://github.com/HugoPoi) - Contributor
- [gunta987](https://github.com/gunta987) - Contributor
- [Akxe](https://github.com/Akxe) - Contributor
- [TJ Horner](https://github.com/tjhorner) - Contributor
