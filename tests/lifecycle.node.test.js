const extract = require('..');
const MP4Box = require('mp4box');
const { createHash } = require('crypto');
const { box, ftyp, noTrack, malformed, hero8 } = require('./fixtures');

afterEach(() => jest.restoreAllMocks());

test('HERO8 output preserves every byte and all 13 samples', async () => {
  const node = await extract(hero8);
  const browser = await extract(new Blob([hero8]), { browserMode: true });
  expect(Buffer.isBuffer(node.rawData)).toBe(true);
  expect(node.rawData.length).toBe(85940);
  expect(node.timing.samples).toHaveLength(13);
  expect(createHash('sha256').update(node.rawData).digest('hex')).toBe('2cba3bf06130683f09a579ac8130f78634a943d127f419b246289aa31bd372c6');
  expect(Buffer.from(browser.rawData)).toEqual(node.rawData);
  expect(browser.timing).toEqual(node.timing);
});

test.each([
  ['empty', Buffer.alloc(0), 'INVALID_MP4'],
  ['text', Buffer.from('this is not a video'), 'INVALID_MP4'],
  ['ftyp only', ftyp, 'INVALID_MP4'],
  ['malformed moov', malformed, 'INVALID_MP4'],
  ['valid empty container', noTrack, 'TRACK_NOT_FOUND'],
])('%s rejects with a typed error in both input modes', async (name, data, code) => {
  for (const browserMode of [false, true]) {
    const error = await extract(browserMode ? new Blob([data]) : data, { browserMode }).catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(extract.GPMFExtractError);
    expect(error.code).toBe(code);
    expect(error.stack).toEqual(expect.any(String));
    if (name === 'malformed moov') expect(error.cause).toBeInstanceOf(TypeError);
  }
});

test('stops reading and reporting progress once telemetry is complete', async () => {
  const padding = box('free', Buffer.alloc(8 * 1024 * 1024));
  const bytes = Buffer.concat([hero8, padding]);
  let offset = 0;
  let cancelled = false;
  const progress = jest.fn();
  const file = { size: bytes.length, stream: () => new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) return controller.close();
      const end = Math.min(offset + 65536, bytes.length);
      // A view with nonzero byteOffset also guards against backing-buffer leakage.
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }) };
  await extract(file, { browserMode: true, progress });
  const calls = progress.mock.calls.length;
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(cancelled).toBe(true);
  expect(offset).toBeLessThan(bytes.length);
  expect(progress).toHaveBeenCalledTimes(calls);
});

test('legacy producers finalize on flush, including asynchronous invalid input', async () => {
  await expect(extract(parser => {
    setTimeout(() => {
      const buffer = new Uint8Array(ftyp).buffer;
      buffer.fileStart = 0;
      parser.appendBuffer(buffer);
      parser.flush();
      parser.flush();
    }, 0);
  })).rejects.toMatchObject({ code: 'INVALID_MP4' });
});

test('read failures preserve their cause and stop the operation', async () => {
  const cause = new Error('disk failure');
  const file = { size: 10, stream: () => new ReadableStream({ start(c) { c.error(cause); } }) };
  await expect(extract(file, { browserMode: true })).rejects.toMatchObject({ code: 'READ_ERROR', cause });
});

test('cancellation before startup does not open a stream', async () => {
  const file = { stream: jest.fn() };
  await expect(extract(file, { browserMode: true, cancellationToken: { cancelled: true } }))
    .rejects.toMatchObject({ code: 'CANCELLED', message: 'Canceled by user' });
  expect(file.stream).not.toHaveBeenCalled();
});

test('cancellation during progress aborts the reader', async () => {
  const cancellationToken = { cancelled: false };
  let stopped = false;
  const file = { size: hero8.length, stream: () => new ReadableStream({
    pull(c) { c.enqueue(new Uint8Array(ftyp)); },
    cancel() { stopped = true; },
  }, { highWaterMark: 0 }) };
  await expect(extract(file, { browserMode: true, cancellationToken, progress() { cancellationToken.cancelled = true; } }))
    .rejects.toMatchObject({ code: 'CANCELLED' });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(stopped).toBe(true);
});

function fakeParser({ count = 2, onStart = () => {}, onFlush = () => {} } = {}) {
  const parser = {
    stop: jest.fn(), setExtractionOptions: jest.fn(),
    appendBuffer() { this.onReady({ tracks: [{ id: 1, codec: 'gpmd', nb_samples: count, created: new Date(0) }] }); },
    start() { onStart(this); },
    flush() { onFlush(this); },
  };
  jest.spyOn(MP4Box, 'createFile').mockReturnValue(parser);
  return parser;
}
const sample = value => ({ data: Uint8Array.of(value), size: 1, cts: value, duration: 1 });

test('collects batches and lets final flush samples succeed before EOF rejection', async () => {
  const parser = fakeParser({
    onStart: p => p.onSamples(1, null, [sample(1)]),
    onFlush: p => p.onSamples(1, null, [sample(2)]),
  });
  const result = await extract(Buffer.of(1));
  expect(result.rawData).toEqual(Buffer.from([1, 2]));
  expect(result.timing.samples).toHaveLength(2);
  parser.onError('late failure');
  parser.onSamples(1, null, [sample(3)]);
  parser.flush();
  expect(result.timing.samples).toHaveLength(2);
  expect(parser.stop).toHaveBeenCalledTimes(1);
});

test('partial samples at EOF are not returned as successful extraction', async () => {
  fakeParser({ onFlush: p => p.onSamples(1, null, [sample(1)]) });
  await expect(extract(Buffer.of(1))).rejects.toMatchObject({ code: 'INCOMPLETE_TELEMETRY' });
});

test('real truncation distinguishes a missing movie header from incomplete telemetry', async () => {
  const parser = MP4Box.createFile();
  let end;
  parser.onReady = info => {
    const track = info.tracks.find(t => t.codec === 'gpmd');
    const samples = parser.getTrackById(track.id).samples;
    const last = samples[samples.length - 1];
    end = last.offset + last.size - 1;
  };
  const buffer = Uint8Array.from(hero8).buffer;
  buffer.fileStart = 0;
  parser.appendBuffer(buffer);
  expect(end).toBeGreaterThan(0);
  for (const browserMode of [false, true]) {
    const data = hero8.subarray(0, end);
    await expect(extract(browserMode ? new Blob([data]) : data, { browserMode }))
      .rejects.toMatchObject({ code: 'INVALID_MP4' });
  }
  // HERO8 stores moov after mdat. Supply its intact header separately to
  // reproduce a known track whose final sample bytes never arrive.
  await expect(extract(input => {
    const prefix = Uint8Array.from(hero8.subarray(0, end)).buffer;
    prefix.fileStart = 0;
    input.appendBuffer(prefix);
    const moov = Uint8Array.from(hero8.subarray(parser.moov.start)).buffer;
    moov.fileStart = parser.moov.start;
    input.appendBuffer(moov);
    input.flush();
  })).rejects.toMatchObject({ code: 'INCOMPLETE_TELEMETRY' });
});

test('zero-sample track has a distinct error', async () => {
  fakeParser({ count: 0 });
  await expect(extract(Buffer.of(1))).rejects.toMatchObject({ code: 'EMPTY_TELEMETRY' });
});
