const fs = require('fs');
const path = require('path');

function box(type, body = Buffer.alloc(0)) {
  const result = Buffer.alloc(8 + body.length);
  result.writeUInt32BE(result.length);
  result.write(type, 4);
  body.copy(result, 8);
  return result;
}

const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isommp42'));
const mvhd = Buffer.alloc(100);
mvhd.writeUInt32BE(1000, 12);
const noTrack = Buffer.concat([ftyp, box('moov', box('mvhd', mvhd))]);
const malformed = Buffer.concat([ftyp, box('moov')]);
const hero8 = fs.readFileSync(path.join(__dirname, '../samples/hero8.mp4'));

module.exports = { box, ftyp, noTrack, malformed, hero8 };
