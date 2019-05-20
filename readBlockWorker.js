function worker() {
  self.onmessage = function(e) {
    self.postMessage(['workerRunning']);
    if (e.data[0] === 'readBlock') readBlock(e.data[1]);
  };

  //Read chunks progressively in browser
  var chunkSize = 1024 * 1024 * 64; // bytes
  var offsetFlag = 0;
  var offset = 0;

  function readBlock(file) {
    var fileSize = file.size;
    var r = new FileReader();
    var blob = file.slice(offset, chunkSize + offset);
    var onBlockRead = function(evt) {
      if (evt.target.error == null) {
        //Add data to mp4box
        self.postMessage(['onparsedbuffer', evt.target.result, offset]);
        //Record offset for next chunk
        offset += evt.target.result.byteLength;
        //Provide proress percentage
        const prog = Math.ceil((50 * offset) / fileSize) + 50 * offsetFlag;
        self.postMessage(['update', prog]);
      } else {
        reject('Read error: ' + evt.target.error, '');
      }

      //Adapt offset to larger file sizes
      if (offset >= fileSize) {
        self.postMessage(['flush']);
        //TODO maybe just kill the worker, remove condition
        offset = 0;
        offsetFlag++;
        readBlock(file);
        return;
      }
      readBlock(file);
    };
    r.onload = onBlockRead;
    //Use the FileReader
    r.readAsArrayBuffer(blob);
  }
}

module.exports = worker;
