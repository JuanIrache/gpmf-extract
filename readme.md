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
- **useWorker**: Default: _false_. Opt into a web worker. A failed worker attempt retries once on the main thread with a fresh parser. Cancellation does not retry.
- **progress**: Pass a function to read the processed percentage updates. Updates stop when extraction settles; successful extraction may finish before 100% of the file is read. During a worker fallback, progress restarts for the new read.
- **cancellationToken**: An optional object, containing a cancelled property, that allows for cancelling the extraction process. Currently only supported in browser mode. If cancelled, the extraction process will fail with the error message "Canceled by user".

```js
const gpmfExtract = require('gpmf-extract');
const progress = percent => console.log(`${percent}% processed`);
const cancellationToken = { cancelled: false };
gpmfExtract(file, { browserMode: true, progress, cancellationToken }).then(
  res => {
    // Do what you want with the data
  },
  error => console.error(error.code, error.message)
);
// Some other processes
cancellationToken.cancelled = true;
```

## Errors and migration from 0.3.x

Extraction rejects with `GPMFExtractError`, an `Error` subclass exported by the package. Match `error.code` instead of comparing the rejection directly to a string. Existing messages for missing tracks, incompatible files, and cancellation are preserved, but string equality is no longer compatible. The worker is now opt-in. These changes are intended for the next minor release (0.4.0).

| Code | Meaning |
| --- | --- |
| `INVALID_MP4` | Empty, malformed, or incomplete container that could not be recognised |
| `TRACK_NOT_FOUND` | Recognised container without a gpmd track |
| `EMPTY_TELEMETRY` | gpmd track declares no samples |
| `INCOMPLETE_TELEMETRY` | EOF arrived before all declared telemetry samples |
| `CANCELLED` | Cancellation token was set |
| `READ_ERROR` | Input could not be read |
| `PARSE_ERROR` | Parsing failed after container recognition |

Low-level failures are retained in `error.cause`. If both a worker and its main-thread retry fail, `error.workerError` contains the initial worker failure. A missing file argument continues to throw a synchronous `TypeError`.

Successful extraction stops the reader immediately. A file with telemetry but no GPS fix still succeeds. Finite inputs settle at EOF without a timer. Custom Node producer functions must call the supplied parser's `flush()` at EOF; the library cannot infer when an external producer has finished. Such producers own their streams and remain responsible for closing them. Cancellation tokens are checked at startup and between chunks/callbacks, not while an external read is stalled.

## Tests

Run `npm ci` and `npm test -- --runInBand`. Tests include actual browser workers, forced worker failures, EOF/error handling, and sample output checks. Set `PUPPETEER_EXECUTABLE_PATH` to test an installed Chromium. The optional large-file test requires `gpmf-extract-large-file`.

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
