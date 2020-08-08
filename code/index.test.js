const gpmfExtract = require('..');
const fs = require('fs');

const path = './samples/karma.mp4';
const extracted = fs.readFileSync('./samples/karma.raw');

function toBuffer(ab) {
  var buf = Buffer.alloc(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

describe('Testing the extracted raw data and timing from Buffer', () => {
  let res;
  beforeAll(async () => {
    const file = fs.readFileSync(path);
    res = await gpmfExtract(file);
  });

  test('The output should match the raw sample', () => {
    expect(Buffer.compare(toBuffer(res.rawData), extracted)).toBe(0);
  });

  test('The output should have framerate data', () => {
    expect(res.timing.frameDuration).toBe(0.03336666666666667);
  });

  test('The output should contain the video duration', () => {
    expect(res.timing.videoDuration).toBe(12.078733333333334);
  });
});

describe('Testing the extracted raw data and timing from Path', () => {
  let res;
  beforeAll(async () => {
    res = await gpmfExtract(path,false,undefined,{chunkSize: 10 * 1024 * 1024});
  });

  test('The output should match the raw sample', () => {
    expect(res).toEqual(expect.anything());
    expect(Buffer.compare(toBuffer(res.rawData), extracted)).toBe(0);
  });

  test('The output should have framerate data', () => {
    expect(res.timing.frameDuration).toBe(0.03336666666666667);
  });

  test('The output should contain the video duration', () => {
    expect(res.timing.videoDuration).toBe(12.078733333333334);
  });
});

/// @see set gpmf-extract-large-file=/gopro/20200802/GH010368.MP4&&npm test
const largeFilePath = process.env["gpmf-extract-large-file"];
if (largeFilePath) {
  describe('Testing the extracted raw data and timing from the path of the full length video: "' + largeFilePath + '"', () => {
    test('The output should extracted', async() => {
      jest.setTimeout(30000);
      const res = await gpmfExtract(largeFilePath,false,undefined,{chunkSize: 100 * 1024 * 1024});
      expect(res).toEqual(expect.anything());
      expect(res.rawData).toEqual(expect.anything());
    });
  });
} else {
  console.log("Large file test is skipped.");
}

