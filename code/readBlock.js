function createReader() {
  function readByBlocks(
    /** @type {File | Blob | Buffer} */
    file,
    /** @type {{chunkSize: number, progress: (progress: number) => void, onParsedBuffer: (buffer: ArrayBuffer, offset: number) => void, flush: () => void, onError: (error: string) => void}} */
    { chunkSize, progress, onParsedBuffer, flush, onError },
  ) {
    const fileSize = file.size || file.byteLength;
    let offset = 0;

    /** @type {(stream: (chunk: any) => void) => Promise<any>} */
    let pipeTo;

    const abortController = new AbortController();
    /** @type {(reason?: any) => void} */
    const terminate = reason => abortController.abort(reason);
    if (file.stream || typeof Blob !== 'undefined') {
      // Browser
      const stream = file.stream ? file.stream() : new Blob([file]).stream();
      pipeTo = write => stream.pipeTo(
        new WritableStream({ write }, { size: () => chunkSize }),
        { signal: abortController.signal },
      );
    } else {
      // NodeJS
      try {
        const { Writable, Readable } = require('stream');
        pipeTo = write => Readable.from(file, { read: () => chunkSize }).pipeTo(
          new Writable({
            write,
            signal: abortController.signal,
          }),
        );
      } catch {
        throw new Error('Cannot use NodeJS stream');
      }
    }

    return {
      terminate,
      result: pipeTo(chunk => {
        onParsedBuffer(chunk, offset);
        offset += chunk.byteLength;
        const prog = Math.ceil(offset / fileSize * 100);
        if (prog > 200) {
          throw new Error('Progress went beyond 100%');
        } else if (progress) {
          progress(prog);
        }
      }).then(val => {
        flush();
        return val;
      }).catch(err => {
        onError(err);
      }),
    };
  }

  if (typeof createReader !== 'undefined') {
    createReader.readByBlocks = readByBlocks;
    createReader.readByBlocksWorker = createReader;
  } else {
    self.onmessage = function (e) {
      if (e.data[0] === 'readBlock') {
        const { terminate } = readByBlocks(
          e.data[1],
          {
            chunkSize: 1024 * 1024 * 16,
            progress(progress) {
              self.postMessage(['progress', progress]);
            },
            onParsedBuffer(buffer, offset) {
              self.postMessage(['onParsedBuffer', buffer, offset]);
            },
            flush() {
              self.postMessage(['flush']);
            },
            onError(err) {
              self.postMessage(['onError', err]);
            },
          },
        );

        self.onabort = terminate;
      };
    };
  }
}

// Initialize worker/non-worker
createReader();
module.exports = createReader;
exports = module.exports;
exports.readByBlocksWorker = createReader.readByBlocksWorker;
exports.readByBlocks = createReader.readByBlocks;
