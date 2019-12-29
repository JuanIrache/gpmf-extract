module.exports = function() {
  //Read chunks progressively in browser
  var chunkSize = 1024 * 1024 * 2; // bytes
  var offsetFlag = 0;
  var offset = 0;
  var gotSamples;

  function stop() {
    gotSamples = true;
  }

  //We get functions to run on certain event from parent function
  function read(file, { update, onparsedbuffer, mp4boxFile }) {
    var fileSize = file.size;
    var r = new FileReader();
    var blob = file.slice(offset, chunkSize + offset);
    r.onload = function(evt) {
      if (evt.target.error == null) {
        //Tell parent function to add data to mp4box
        onparsedbuffer(evt.target.result, offset);
        //Record offset for next chunk
        offset += evt.target.result.byteLength;
        //Provide proress percentage to parent function
        var prog = Math.ceil((50 * offset) / fileSize) + 50 * offsetFlag;
        if (update) update(prog);
      } else reject('Read error: ' + evt.target.error, '');

      //Adapt offset to larger file sizes
      if (offset >= fileSize) {
        //Tell parent function to flush mp4box
        mp4boxFile.flush();
        offset = 0;
        offsetFlag++;
        if (!gotSamples) read(file, { update, onparsedbuffer, mp4boxFile });
        return;
      }
      read(file, { update, onparsedbuffer, mp4boxFile });
    };
    //Use the FileReader
    r.readAsArrayBuffer(blob);
  }
  return { read, stop };
};
