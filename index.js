const MP4Box = require('mp4box');
const { readByBlocksWorker, readByBlocks } = require('./code/readBlock');
const InlineWorker = require('./code/inline-worker');
const { GPMFExtractError, asError } = require('./code/errors');

function GPMFExtract(file, { browserMode, progress, useWorker = false, cancellationToken } = {}) {
  if (!file) throw new TypeError('File not provided');

  return new Promise((resolve, reject) => {
    let settled = false;
    let current;

    function stop(attempt) {
      if (!attempt) return;
      attempt.active = false;
      attempt.parser.stop();
      if (attempt.reader) attempt.reader.terminate();
    }

    function finish(error, result) {
      if (settled) return;
      settled = true;
      stop(current);
      if (error) reject(error);
      else resolve(result);
    }

    function start(workerMode, workerError) {
      const parser = MP4Box.createFile();
      const attempt = { parser, active: true, reader: null };
      current = attempt;
      const timing = { samples: [] };
      let ready = false;
      let track;
      let received = 0;
      let byteLength = 0;
      const parts = [];
      const active = () => !settled && attempt.active && current === attempt;

      function fail(error) {
        if (!active()) return;
        if (cancellationToken?.cancelled) error = new GPMFExtractError('CANCELLED');
        if (workerMode && error.code !== 'CANCELLED') {
          stop(attempt);
          start(false, error);
        } else {
          if (workerError) error.workerError = workerError;
          finish(error);
        }
      }

      function cancelled() {
        if (!active()) return true;
        if (!cancellationToken?.cancelled) return false;
        fail(new GPMFExtractError('CANCELLED'));
        return true;
      }

      // Catch parser exceptions even when a producer appends asynchronously.
      function parse(action) {
        if (cancelled()) return;
        try { return action(); }
        catch (error) { fail(asError(error, ready ? 'PARSE_ERROR' : 'INVALID_MP4')); }
      }

      parser.onError = error => fail(asError(error, ready ? 'PARSE_ERROR' : 'INVALID_MP4'));
      parser.onReady = videoData => {
        if (cancelled()) return;
        ready = true;
        track = videoData.tracks.find(candidate => candidate.codec === 'gpmd');
        if (!track) return fail(new GPMFExtractError('TRACK_NOT_FOUND'));
        if (!track.nb_samples) return fail(new GPMFExtractError('EMPTY_TELEMETRY'));

        timing.start = new Date(track.created);
        timing.start.setMinutes(timing.start.getMinutes() + timing.start.getTimezoneOffset());
        let foundVideo = false;
        for (const video of videoData.tracks) {
          if (video !== track && !foundVideo &&
              (video.type === 'video' || video.name === '\fVideoHandler' || video.track_height > 0)) {
            foundVideo = video.type === 'video';
            timing.videoDuration = video.movie_duration / video.movie_timescale;
            timing.frameDuration = timing.videoDuration / video.nb_samples;
          }
        }
        parser.setExtractionOptions(track.id, null, { nbSamples: track.nb_samples });
        parser.start();
      };

      parser.onSamples = (id, user, samples) => {
        if (cancelled() || !track || id !== track.id) return;
        for (const sample of samples) {
          parts.push(sample.data);
          byteLength += sample.size;
          timing.samples.push({ cts: sample.cts, duration: sample.duration });
          received++;
        }
        if (received !== track.nb_samples) return;
        const data = new Uint8Array(byteLength);
        let offset = 0;
        for (const part of parts) {
          data.set(part, offset);
          offset += part.byteLength;
        }
        finish(null, { rawData: browserMode ? data : Buffer.from(data), timing });
      };

      const append = parser.appendBuffer.bind(parser);
      parser.appendBuffer = buffer => parse(() => append(buffer));
      const flush = parser.flush.bind(parser);
      parser.flush = () => parse(() => {
        flush();
        if (!active()) return;
        fail(new GPMFExtractError(!ready ? 'INVALID_MP4' : 'INCOMPLETE_TELEMETRY'));
      });

      function onParsedBuffer(bytes, offset) {
        if (cancelled()) return;
        // Streams may yield a view into a larger backing buffer.
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        buffer.fileStart = offset;
        parser.appendBuffer(buffer);
      }

      function onProgress(value) {
        if (cancelled() || !progress) return;
        try { progress(value); }
        catch (error) { fail(asError(error, 'READ_ERROR')); }
      }

      if (cancelled()) return;
      try {
        if (!browserMode) {
          if (typeof file === 'function') {
            // Legacy producers signal EOF by calling the wrapped flush().
            file(parser);
          } else if (typeof Buffer === 'function' && Buffer.isBuffer(file)) {
            onParsedBuffer(file, 0);
            parser.flush();
          } else fail(new GPMFExtractError('INVALID_MP4'));
        } else if (workerMode) {
          const worker = new InlineWorker(readByBlocksWorker);
          attempt.reader = worker;
          worker.onmessage = event => {
            if (!active()) return;
            const [type, value, offset] = event.data;
            if (type === 'onParsedBuffer') {
              onParsedBuffer(value, offset);
              if (active()) worker.postMessage(['ack']);
            } else if (type === 'progress') onProgress(value);
            else if (type === 'flush') parser.flush();
            else if (type === 'onError') fail(asError(value, 'READ_ERROR'));
          };
          worker.onerror = event => {
            if (event.preventDefault) event.preventDefault();
            fail(asError(event.error || event.message, 'READ_ERROR'));
          };
          worker.onmessageerror = event => fail(asError(event.data, 'READ_ERROR'));
          worker.postMessage(['readBlock', file]);
        } else {
          attempt.reader = readByBlocks(file, {
            chunkSize: 2 * 1024 * 1024,
            progress: onProgress,
            onParsedBuffer,
            flush: () => parser.flush(),
            onError: error => fail(asError(error, 'READ_ERROR')),
          });
        }
      } catch (error) { fail(asError(error, 'READ_ERROR')); }
    }

    start(Boolean(browserMode && useWorker && typeof window !== 'undefined' && window.Worker));
  });
}

module.exports = GPMFExtract;
module.exports.GPMFExtract = GPMFExtract;
module.exports.GPMFExtractError = GPMFExtractError;
