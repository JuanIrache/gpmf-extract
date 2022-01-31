//Does the same as ReadBlock but in web worker form to avoid blocking the browser
function worker() {
  self.onmessage = function (e) {
    if (e.data[0] === 'readBlock') readBlock(e.data[1]);
  };

  //Read chunks progressively in browser
  var chunkSize = 1024 * 1024 * 16; // bytes
  var offsetFlag = 0;
  var offset = 0;

  function readBlock(file) {
    var fileSize = file.size;
    var r = new FileReader();
    var blob = file.slice(offset, chunkSize + offset);
    var onBlockRead = function (evt) {
      if (evt.target.error == null) {
        //Tell parent funciton to add data to mp4box
        self.postMessage(['onparsedbuffer', evt.target.result, offset]);
        //Record offset for next chunk
        offset += evt.target.result.byteLength;
        //Provide proress percentage to parent function
        const prog = Math.ceil((50 * offset) / fileSize) + 50 * offsetFlag;
        if (prog > 200) {
          self.postMessage(['onError', 'Progress went beyond 100%']);
        } else self.postMessage(['update', prog]);
      } else self.postMessage(['onError', 'Read error: ' + evt.target.error]);

      //Adapt offset to larger file sizes
      if (offset >= fileSize) {
        //Tell parent funciton to flush mp4box
        self.postMessage(['flush']);
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
