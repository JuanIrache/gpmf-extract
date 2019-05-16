const gpmfExtract = require('../');
const fs = require('fs');

const file = fs.readFileSync('./samples/larg.mp4');

gpmfExtract(file)
  .then(raw => console.log('data received'))
  .catch(error => console.log(error));
