/**
 *
 * @param {'worker' | 'main' | undefined} mode defaults to worker
 * @returns Either worker fn body or function to read file by blocks in main thread
 */
function createReader(mode = 'worker') {
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
    if (file.stream || Blob) {
      // Browser
      const stream = file.stream ? file.stream() : new Blob([file]).stream();
      pipeTo = write => stream.pipeTo(
        new WritableStream({ write }, { size: () => chunkSize }),
        { signal: abortController.signal },
      );
    } else if (Buffer) {
      // NodeJS
      pipeTo = write => require('stream').Readable.from(file, { read: () => chunkSize }).pipeTo(
        new require('stream').Writable({
          write,
          signal: abortController.signal,
        }),
      );
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

  if (mode == 'main' || typeof self === 'undefined') {
    return readByBlocks;
  }

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

module.exports = createReader;
exports = module.exports;
exports.readByBlocksWorker = createReader;
exports.readByBlocks = createReader('main');
