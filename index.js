const MP4Box = require('mp4box');
const { readByBlocksWorker, readByBlocks } = require('./code/readBlock');
const InlineWorker = require('./code/inline-worker');

//Will convert the final uint8Array to buffer
//https://stackoverflow.com/a/12101012/3362074
function toBuffer(ab) {
  var buf = Buffer.alloc(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

//And back
function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

function GPMFExtract (
  file,
  { browserMode, progress, useWorker = true, cancellationToken } = {}
) {
  if (!file) {
    throw new TypeError('File not provided');
  }

  var trackId;
  var nb_samples;
  /** @type {{ terminate(): void }} */
  var fileReaderByBlocks;
  return new Promise(function (resolve, reject) {
    var mp4boxFile = MP4Box.createFile();
    var uintArr;
    //Will store timing data to help analyse the extracted data
    var timing = {};
    mp4boxFile.onError = reject;

    //When the data is ready, look for the right track
    mp4boxFile.onReady = function (videoData) {
      var foundVideo = false;
      for (var i = 0; i < videoData.tracks.length; i++) {
        //Find the metadata track. Collect Id and number of samples
        if (videoData.tracks[i].codec == 'gpmd') {
          trackId = videoData.tracks[i].id;
          nb_samples = videoData.tracks[i].nb_samples;
          timing.start = videoData.tracks[i].created;
          // Try to correct GoPro's badly encoded time zone
          timing.start.setMinutes(
            timing.start.getMinutes() + timing.start.getTimezoneOffset()
          );
        } else if (
          !foundVideo &&
          (videoData.tracks[i].type === 'video' ||
            videoData.tracks[i].name === 'VideoHandler' ||
            videoData.tracks[i].track_height > 0)
        ) {
          // Only confirm video track if found by type, in case more than one meet the other conditions
          if (videoData.tracks[i].type === 'video') foundVideo = true;
          var vid = videoData.tracks[i];
          timing.videoDuration = vid.movie_duration / vid.movie_timescale;
          //Deduce framerate from video track
          timing.frameDuration = timing.videoDuration / vid.nb_samples;
        }
      }
      if (trackId != null) {
        //Request the track
        mp4boxFile.setExtractionOptions(trackId, null, {
          nbSamples: nb_samples
        });

        //When samples arrive
        mp4boxFile.onSamples = function (id, user, samples) {
          // No need to close a closed stream
          var totalSamples = samples.reduce(function (acc, cur) {
            return acc + cur.size;
          }, 0);

          //Save the time and duration of each sample
          timing.samples = [];

          //Store them in Uint8Array
          uintArr = new Uint8Array(totalSamples);
          var runningCount = 0;
          samples.forEach(function (sample) {
            timing.samples.push({ cts: sample.cts, duration: sample.duration });
            // The loop prevents Firefox from crashing
            for (var i = 0; i < sample.size; i++) {
              uintArr.set(sample.data, runningCount);
            }
            runningCount += sample.size;
          });

          //Convert to Buffer if in Node
          var rawData = browserMode ? uintArr : toBuffer(uintArr);

          //And return it
          resolve({ rawData, timing });
        };
        mp4boxFile.start();
      } else {
        fileReaderByBlocks.terminate('Track not found');
        // Terminating the worker causes an error to be thrown
      }
    };

    //Use chunk system in browser
    if (browserMode) {
      //Define functions the child process will call
      function onParsedBuffer (unit8array, offset) {
        const buffer = unit8array.buffer;
        if (buffer.byteLength === 0) {
          fileReaderByBlocks.terminate('File not compatible');
        }
        buffer.fileStart = offset;
        if (cancellationToken?.cancelled) {
          fileReaderByBlocks.terminate('Canceled by user');
        } else {
          mp4boxFile.appendBuffer(buffer);
        }
      };
      // var flush = mp4boxFile.flush;
      //Try to use a web worker to avoid blocking the browser
      if (useWorker && typeof window !== 'undefined' && window.Worker) {
        fileReaderByBlocks = new InlineWorker(readByBlocksWorker, {});
        fileReaderByBlocks.onmessage = function (e) {
          //Run functions when the web worker requests them
          if (e.data[0] === 'progress' && progress) progress(e.data[1]);
          else if (e.data[0] === 'onParsedBuffer') {
            onParsedBuffer(e.data[1], e.data[2]);
          } else if (e.data[0] === 'flush') {
            mp4boxFile.flush();
          } else if (e.data[0] === 'onError') {
            reject(e.data[1]);
          }
        };

        //If the worker crashes, run the old function
        fileReaderByBlocks.onerror = function (e) {
          if (e == 'Track not found') {
            //The file has finished reading and did not find any track, no need to retry
            reject(e);
            return;
          }

          mp4boxFile = MP4Box.createFile();
          fileReaderByBlocks = readByBlocks(file, {
            chunkSize: 1024 * 1024 * 2,
            progress,
            onParsedBuffer,
            flush: () => mp4boxFile.flush(),
            onError: reject,
          });
        };
        //Start worker
        fileReaderByBlocks.postMessage(['readBlock', file]);
        //If workers not supported, use old strategy
      } else {
        fileReaderByBlocks = readByBlocks(file, {
          chunkSize: 1024 * 1024 * 2,
          progress,
          onParsedBuffer,
          flush: () => mp4boxFile.flush(),
          onError: reject,
        });
      }
    } else {
      //Nodejs
      if (typeof file === 'function') {
        file(mp4boxFile);
      } else if (typeof Buffer == 'function' && file instanceof Buffer) {
        var arrayBuffer = toArrayBuffer(file);
        if (arrayBuffer.byteLength === 0) reject('File not compatible');

        arrayBuffer.fileStart = 0;

        //Assign data to mp4box
        mp4boxFile.appendBuffer(arrayBuffer);
      } else {
        reject('File not compatible');
      }
    }
  });
};

module.exports = GPMFExtract;
exports = module.exports;
exports.GPMFExtract = GPMFExtract;
