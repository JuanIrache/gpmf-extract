const gpmfExtract = require('../');
const fs = require('fs');

const file = fs.readFileSync('./samples/karma.mp4');

gpmfExtract(file)
  .then(result => {
    console.log('Length of data received:', result.rawData.length);
    console.log('Framerate of data received:', result.timing.frameDuration);
  })
  .catch(error => console.log(error));
