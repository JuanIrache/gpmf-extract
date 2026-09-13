// This factory is also serialized into a worker: keep it self-contained.
function createReader(workerScope) {
  function readByBlocks(file, { chunkSize, progress, onParsedBuffer, flush, onError }) {
    const fileSize = file.size ?? file.byteLength;
    let offset = 0;
    const controller = new AbortController();
    const terminate = reason => controller.abort(reason);
    const stream = file.stream ? file.stream() : new Blob([file]).stream();
    // Defer startup until the caller has stored the termination handle.
    const result = Promise.resolve().then(() => stream.pipeTo(new WritableStream({
      async write(chunk) {
        if (controller.signal.aborted) return;
        const length = chunk.byteLength;
        await onParsedBuffer(chunk, offset);
        if (controller.signal.aborted) return;
        offset += length;
        if (progress) progress(fileSize ? Math.min(100, Math.ceil(offset / fileSize * 100)) : 100);
      },
    }, { highWaterMark: chunkSize, size: chunk => chunk.byteLength }), {
      signal: controller.signal,
    })).then(() => {
      if (!controller.signal.aborted) flush();
    }).catch(error => {
      if (!controller.signal.aborted) onError(error);
    });
    return { terminate, result };
  }

  if (workerScope) {
    let acknowledge;
    workerScope.onmessage = event => {
      if (event.data[0] === 'ack') {
        if (acknowledge) acknowledge();
        acknowledge = null;
      } else if (event.data[0] === 'readBlock') {
        try {
          readByBlocks(event.data[1], {
            chunkSize: 2 * 1024 * 1024,
            progress: value => workerScope.postMessage(['progress', value]),
            onParsedBuffer: (bytes, offset) => new Promise(resolve => {
              acknowledge = resolve;
              const data = bytes.slice();
              workerScope.postMessage(['onParsedBuffer', data, offset], [data.buffer]);
            }),
            flush: () => workerScope.postMessage(['flush']),
            onError: error => workerScope.postMessage(['onError', { name: error.name, message: error.message }]),
          });
        } catch (error) {
          workerScope.postMessage(['onError', { name: error.name, message: error.message }]);
        }
      }
    };
  }
  return readByBlocks;
}

exports.readByBlocks = createReader();
exports.readByBlocksWorker = createReader;
