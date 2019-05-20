var MP4Box = require('mp4box');
var readBlock = require('./readBlock');
var readBlockWorker = require('./readBlockWorker');
var mp4boxFile;
var trackId;
var nb_samples;
var worker;
var workerRunning;
var workerSkipped;

//Will convert the final uint8Array to buffer
function toBuffer(ab) {
  var buf = Buffer.alloc(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

module.exports = function(file, isBrowser = false, update) {
  return new Promise(function(resolve, reject) {
    mp4boxFile = MP4Box.createFile(false);
    var uintArr;
    //Will store timing data to help analyse the extracted data
    var timing = {};
    mp4boxFile.onError = function(e) {
      reject(e);
    };

    //When the data is ready, look for the right track
    mp4boxFile.onReady = function(videoData) {
      for (var i = 0; i < videoData.tracks.length; i++) {
        //Find the metadata track. Collect Id and number of samples
        if (videoData.tracks[i].codec == 'gpmd') {
          trackId = videoData.tracks[i].id;
          nb_samples = videoData.tracks[i].nb_samples;
          timing.start = videoData.tracks[i].created;
        } else if (videoData.tracks[i].type == 'video') {
          var vid = videoData.tracks[i];
          //Deduce framerate from video track
          timing.frameDuration = vid.movie_duration / vid.movie_timescale / vid.nb_samples;
        }
      }
      if (trackId != null) {
        //Request the track
        mp4boxFile.setExtractionOptions(trackId, null, {
          nbSamples: nb_samples
        });

        //When samples arrive
        mp4boxFile.onSamples = function(id, user, samples) {
          if (workerRunning) worker.terminate();
          else readBlock.stop();
          var totalSamples = samples.reduce(function(acc, cur) {
            return acc + cur.size;
          }, 0);

          //Save the time and duration of each sample
          timing.samples = [];

          //Store them in Uint8Array
          uintArr = new Uint8Array(totalSamples);
          var runningCount = 0;
          samples.forEach(function(sample) {
            timing.samples.push({ cts: sample.cts, duration: sample.duration });
            for (var i = 0; i < sample.size; i++) {
              uintArr.set(sample.data, runningCount);
            }
            runningCount += sample.size;
          });

          //Convert to Buffer
          var rawData = toBuffer(uintArr);

          //And return it
          resolve({ rawData, timing });
        };
        mp4boxFile.start();
      } else {
        reject('Track not found');
      }
    };

    //Use chunk system in browser
    if (isBrowser) {
      var onparsedbuffer = function(buffer, offset) {
        buffer.fileStart = offset;
        mp4boxFile.appendBuffer(buffer);
      };
      var flush = function() {
        mp4boxFile.flush();
      };
      if (window.Worker) {
        // Build a worker from an anonymous function body
        var blobURL = URL.createObjectURL(new Blob(['(', readBlockWorker.toString(), ')()'], { type: 'application/javascript' }));
        worker = new Worker(blobURL);

        // Won't be needing this anymore
        URL.revokeObjectURL(blobURL);

        worker.onmessage = function(e) {
          if (e.data[0] === 'update' && update) update(e.data[1]);
          else if (e.data[0] === 'onparsedbuffer') onparsedbuffer(e.data[1], e.data[2]);
          else if (e.data[0] === 'flush') flush();
          else if (e.data[0] === 'workerRunning' && !workerSkipped) workerRunning = true;
        };

        worker.postMessage(['readBlock', file]); // Start the worker.

        setTimeout(() => {
          if (!workerRunning) {
            workerSkipped = true;
            readBlock.read(file, mp4boxFile, { update, onparsedbuffer, flush });
          }
        }, 300);
      } else readBlock.read(file, mp4boxFile, { update, onparsedbuffer, flush });
    } else {
      //Nodejs
      var arrayBuffer = new Uint8Array(file).buffer;
      arrayBuffer.fileStart = 0;

      //Assign data to mp4box
      mp4boxFile.appendBuffer(arrayBuffer);
    }
  });
};
