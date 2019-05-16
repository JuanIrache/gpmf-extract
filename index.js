var MP4Box = require('mp4box');
//In the browser, we need to read the file by chunks
var chunkSize = 1024 * 1024; // bytes
var mp4boxFile;
var trackId;
var nb_samples;

module.exports = function(file, isBrowser = false, update) {
  return new Promise(function(resolve, reject) {
    var fileSize = file.size;
    var offset = 0;
    var offsetFlag = 0;
    mp4boxFile = MP4Box.createFile(false);
    var uintArr;
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
        }
      }
      if (trackId != null) {
        //Request the track
        mp4boxFile.setExtractionOptions(trackId, null, {
          nbSamples: nb_samples
        });

        //When samples arrive
        mp4boxFile.onSamples = function(id, user, samples) {
          var totalSamples = samples.reduce(function(acc, cur) {
            return acc + cur.size;
          }, 0);

          //Store them in Uint8Array
          uintArr = new Uint8Array(totalSamples);
          var runningCount = 0;
          samples.forEach(function(sample) {
            for (var i = 0; i < sample.size; i++) {
              uintArr.set(sample.data, runningCount);
            }
            runningCount += sample.size;
          });

          //And return it
          resolve(uintArr);
        };
        mp4boxFile.start();
      } else {
        reject('Track not found');
      }
    };

    //Read chunks progressively in browser
    var readBlock = function(_offset, length, _file) {
      var r = new FileReader();
      var blob = _file.slice(_offset, length + _offset);
      var onBlockRead = function(evt) {
        if (evt.target.error == null) {
          //Add data to mp4box
          var onparsedbuffer = function(mp4box, buffer) {
            buffer.fileStart = offset;
            mp4box.appendBuffer(buffer);
          };
          onparsedbuffer(mp4boxFile, evt.target.result);
          //Record offset for next chunk
          offset += evt.target.result.byteLength;
          if (update) {
            //Provide proress percentage
            const prog = Math.ceil((50 * offset) / fileSize) + 50 * offsetFlag;
            update(prog);
          }
        } else {
          reject('Read error: ' + evt.target.error, '');
        }

        //Adapt offset to larger file sizes
        if (offset >= fileSize) {
          mp4boxFile.flush();
          if (!uintArr) {
            offset = 0;
            offsetFlag++;
            readBlock(offset, chunkSize, file);
          }
          return;
        }
        readBlock(offset, chunkSize, file);
      };
      r.onload = onBlockRead;
      //Use the FileReader
      r.readAsArrayBuffer(blob);
    };

    //Only use chunk system in browser
    if (isBrowser) readBlock(offset, chunkSize, file);
    else {
      //Nodejs
      var arrayBuffer = new Uint8Array(file).buffer;
      arrayBuffer.fileStart = 0;

      //Assign data to mp4box
      mp4boxFile.appendBuffer(arrayBuffer);
    }
  });
};
