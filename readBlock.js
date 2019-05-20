//Read chunks progressively in browser
var chunkSize = 1024 * 1024 * 2; // bytes
var offsetFlag = 0;
var offset = 0;
var gotSamples;

function stop() {
  gotSamples = true;
}

function read(file, mp4boxFile, { update, onparsedbuffer, flush }) {
  var fileSize = file.size;
  var r = new FileReader();
  var blob = file.slice(offset, chunkSize + offset);
  var onBlockRead = function(evt) {
    if (evt.target.error == null) {
      //Add data to mp4box
      onparsedbuffer(evt.target.result, offset);
      //Record offset for next chunk
      offset += evt.target.result.byteLength;
      //Provide proress percentage
      const prog = Math.ceil((50 * offset) / fileSize) + 50 * offsetFlag;
      if (update) update(prog);
    } else reject('Read error: ' + evt.target.error, '');

    //Adapt offset to larger file sizes
    if (offset >= fileSize) {
      flush();
      offset = 0;
      offsetFlag++;
      if (!gotSamples) read(file, mp4boxFile, { update, onparsedbuffer, flush });
      return;
    }
    read(file, mp4boxFile, { update, onparsedbuffer, flush });
  };
  r.onload = onBlockRead;
  //Use the FileReader
  r.readAsArrayBuffer(blob);
}

module.exports = { read, stop };
