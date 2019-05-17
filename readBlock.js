//Read chunks progressively in browser
var chunkSize = 1024 * 1024; // bytes
var offsetFlag = 0;
var offset = 0;

function readBlock(file, mp4boxFile, gotSamples, update) {
  var fileSize = file.size;
  var r = new FileReader();
  var blob = file.slice(offset, chunkSize + offset);
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
      if (!gotSamples) {
        offset = 0;
        offsetFlag++;
        readBlock(file, mp4boxFile, gotSamples, update);
      }
      return;
    }
    readBlock(file, mp4boxFile, gotSamples, update);
  };
  r.onload = onBlockRead;
  //Use the FileReader
  r.readAsArrayBuffer(blob);
}

module.exports = readBlock;
