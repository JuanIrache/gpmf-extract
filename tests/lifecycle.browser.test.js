const { join } = require('path');
const { createHash } = require('crypto');
const { ftyp, malformed, noTrack } = require('./fixtures');

beforeEach(async () => {
  await page.goto(`file://${join(__dirname, 'browser/index.html')}`);
  await (await page.$('input')).uploadFile(join(__dirname, '../samples/hero8.mp4'));
});

// Counts actual worker construction and main-thread reads: fallback cannot
// silently make a broken worker look like a passing direct-worker test.
async function run(options) {
  return page.evaluate(async ({ options, noTrack }) => {
    const nativeWorker = window.Worker;
    const nativeStream = Blob.prototype.stream;
    const createURL = URL.createObjectURL.bind(URL);
    const revokeURL = URL.revokeObjectURL.bind(URL);
    const urls = new Set();
    let workers = 0;
    let terminated = 0;
    let mainReads = 0;
    let progress = 0;
    URL.createObjectURL = blob => { const url = createURL(blob); urls.add(url); return url; };
    URL.revokeObjectURL = url => { urls.delete(url); revokeURL(url); };
    Blob.prototype.stream = function () { mainReads++; return nativeStream.call(this); };
    window.Worker = class extends nativeWorker {
      constructor(url) {
        if (options.fault === 'construction') throw new Error('Worker blocked');
        let replacement;
        if (options.fault === 'runtime') replacement = 'throw new Error("Worker crashed")';
        if (options.fault === 'reported') replacement = 'onmessage = () => postMessage(["onError", {message:"Read failed"}])';
        let faultURL;
        if (replacement) faultURL = createURL(new Blob([replacement], { type: 'text/javascript' }));
        super(faultURL || url);
        if (faultURL) revokeURL(faultURL);
        workers++;
      }
      postMessage(message, ...args) {
        if (message[0] === 'readBlock' && ['stale', 'messageerror'].includes(options.fault)) {
          const onmessage = this.onmessage;
          queueMicrotask(() => {
            if (options.fault === 'messageerror') this.onmessageerror({ data: null });
            else this.onerror({ message: 'Injected crash', preventDefault() {} });
            // Queued messages from a terminated attempt cannot finalize its retry.
            onmessage({ data: ['flush'] });
            onmessage({ data: ['onError', { message: 'late failure' }] });
          });
          return;
        }
        if (message[0] === 'readBlock' && options.fault === 'missing-track') {
          message = ['readBlock', new Blob([Uint8Array.from(noTrack)])];
        }
        return super.postMessage(message, ...args);
      }
      terminate() { terminated++; return super.terminate(); }
    };
    const token = { cancelled: Boolean(options.cancelBefore) };
    const file = options.bytes ? new Blob([Uint8Array.from(options.bytes)]) : document.querySelector('input').files[0];
    let output;
    try {
      const result = await GPMFExtract(file, {
        browserMode: true,
        ...(options.useWorker === undefined ? {} : { useWorker: options.useWorker }),
        cancellationToken: token,
        progress() { progress++; if (options.cancelDuring) token.cancelled = true; },
      });
      output = { bytes: Array.from(result.rawData), timing: result.timing };
    } catch (error) {
      output = { code: error.code, isError: error instanceof Error,
        typed: error instanceof GPMFExtract.GPMFExtractError, workerError: error.workerError?.code };
    }
    const progressAtSettlement = progress;
    await new Promise(resolve => setTimeout(resolve, 30));
    window.Worker = nativeWorker;
    Blob.prototype.stream = nativeStream;
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
    return { ...output, workers, terminated, mainReads, liveURLs: urls.size, lateProgress: progress - progressAtSettlement };
  }, { options, noTrack: Array.from(noTrack) });
}

test.each([undefined, false, true])('HERO8 succeeds with useWorker=%s and releases resources', async useWorker => {
  const result = await run({ useWorker });
  expect(result.code).toBeUndefined();
  expect(result.bytes).toHaveLength(85940);
  expect(createHash('sha256').update(Buffer.from(result.bytes)).digest('hex')).toBe('2cba3bf06130683f09a579ac8130f78634a943d127f419b246289aa31bd372c6');
  expect(result.timing.samples).toHaveLength(13);
  expect(result.workers).toBe(useWorker ? 1 : 0);
  expect(result.mainReads).toBe(useWorker ? 0 : 1);
  expect(result.terminated).toBe(result.workers);
  expect(result.liveURLs).toBe(0);
  expect(result.lateProgress).toBe(0);
});

test.each(['construction', 'runtime', 'reported', 'missing-track', 'stale', 'messageerror'])('worker %s failure retries with a working parser', async fault => {
  const result = await run({ useWorker: true, fault });
  expect(result.bytes).toHaveLength(85940);
  expect(result.mainReads).toBe(1);
  expect(result.terminated).toBe(result.workers);
  expect(result.liveURLs).toBe(0);
  expect(result.lateProgress).toBe(0);
});

test('cancellation during fallback stops the retry without another attempt', async () => {
  const result = await run({ useWorker: true, fault: 'reported', cancelDuring: true });
  expect(result.code).toBe('CANCELLED');
  expect(result.workers).toBe(1);
  expect(result.mainReads).toBe(1);
  expect(result.terminated).toBe(1);
  expect(result.liveURLs).toBe(0);
  expect(result.lateProgress).toBe(0);
});

test.each([
  ['empty', [], 'INVALID_MP4'],
  ['text', Array.from(Buffer.from('this is not a video')), 'INVALID_MP4'],
  ['ftyp only', Array.from(ftyp), 'INVALID_MP4'],
  ['malformed moov', Array.from(malformed), 'INVALID_MP4'],
  ['no track', Array.from(noTrack), 'TRACK_NOT_FOUND'],
])('%s settles with the same error in main-thread and worker mode', async (name, bytes, code) => {
  for (const useWorker of [false, true]) {
    const result = await run({ useWorker, bytes });
    expect(result.code).toBe(code);
    expect(result.isError).toBe(true);
    expect(result.typed).toBe(true);
    expect(result.workers).toBe(useWorker ? 1 : 0);
    expect(result.mainReads).toBe(1);
    expect(result.terminated).toBe(result.workers);
    expect(result.liveURLs).toBe(0);
    if (useWorker) expect(result.workerError).toBe(code);
  }
});

test.each([false, true])('cancellation never retries, useWorker=%s', async useWorker => {
  const before = await run({ useWorker, cancelBefore: true });
  expect(before.code).toBe('CANCELLED');
  expect(before.workers).toBe(0);
  expect(before.mainReads).toBe(0);
  const during = await run({ useWorker, cancelDuring: true });
  expect(during.code).toBe('CANCELLED');
  expect(during.mainReads).toBe(useWorker ? 0 : 1);
  expect(during.terminated).toBe(during.workers);
  expect(during.liveURLs).toBe(0);
  expect(during.lateProgress).toBe(0);
});
