const gpmfExtract = require('./');
const fs = require('fs');

const file = fs.readFileSync('./samples/karma.mp4');
const extracted = fs.readFileSync('./samples/karma.raw');

function toBuffer(ab) {
  var buf = Buffer.alloc(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

test('The output should match the raw sample', async () => {
  expect.assertions(1);
  gpmfExtract(file)
    .then(rd => {
      expect(Buffer.compare(toBuffer(rd), extracted)).toBe(0);
    })
    .catch(e => console.log(e));
});
