/// <reference types="jest" />
const { join } = require('path');
const fs = require('fs');

const extracted = Uint8Array.from(fs.readFileSync('./samples/karma.raw'));
const mp4Path = join(__dirname, './samples/karma.mp4');


describe('Testing the extracted raw data and timing from File', () => {
  /** @type {import('puppeteer').ElementHandle<HTMLInputElement>} */
  let inputHandle;
  beforeEach(async () => {
    await page.goto(`file://${join(__dirname, './browser/index.html')}`);
    inputHandle = await page.$('input[type=file]');
    await inputHandle.uploadFile(mp4Path);
  });

  test('Library loaded', async () => {
    expect(1).toBe(1);
    expect(await page.evaluate(() => 1)).toBe(1);
    expect(await page.evaluate(() => GPMFExtract?.name)).toBe('GPMFExtract');
    expect(await page.evaluate(() => document.querySelector('[type=file]').files[0] instanceof File)).toBe(true);
  });

  test('The output should match the raw sample', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      document.querySelector('[type=file]').files[0],
      { browserMode: true },
    ));
    expect(res.rawData.byteLength).toBe(extracted.byteLength);
    expect(res.rawData.every((val, i) => val == extracted[i])).toBe(true);
  }, 300000);

  test('The output should have framerate data', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      document.querySelector('[type=file]').files[0],
      { browserMode: true },
    ));
    expect(res.timing.frameDuration).toBe(0.03336666666666667);
  });

  test('The output should contain the video duration', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      document.querySelector('[type=file]').files[0],
      { browserMode: true },
    ));
    expect(res.timing.videoDuration).toBe(12.078733333333334);
  });
});

describe.skip('Testing the extracted raw data and timing from File', () => {
  /** @type {import('puppeteer').ElementHandle<HTMLInputElement>} */
  let inputHandle;
  beforeEach(async () => {
    await page.goto(`file://${join(__dirname, './browser/index.html')}`);
    inputHandle = await page.$('input[type=file]');
    await inputHandle.uploadFile(mp4Path);
  });

  test('The output should match the raw sample', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      document.querySelector('[type=file]').files[0],
      { browserMode: true, useWorker: true },
    ));
    expect(res.rawData.byteLength).toBe(extracted.byteLength);
    expect(res.rawData.every((val, i) => val == extracted[i])).toBe(true);
  }, 300000);

  test('The output should have framerate data', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      document.querySelector('[type=file]').files[0],
      { browserMode: true, useWorker: true },
    ));
    expect(res.timing.frameDuration).toBe(0.03336666666666667);
  });

  test('The output should contain the video duration', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      document.querySelector('[type=file]').files[0],
      { browserMode: true, useWorker: true },
    ));
    expect(res.timing.videoDuration).toBe(12.078733333333334);
  });
});

describe.skip('Testing the extracted raw data and timing from Blob', () => {
  /** @type {import('puppeteer').Page} */
  let page;
  /** @type {import('puppeteer').ElementHandle<HTMLInputElement>} */
  let inputHandle;
  beforeEach(async () => {
    await page.goto(`file://${join(__dirname, './browser/index.html')}`);
    inputHandle = await page.$('input[type=file]');
    await inputHandle.uploadFile(mp4Path);
  });

  test('The output should match the raw sample', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      new Blob([document.querySelector('[type=file]').files[0]]),
      { browserMode: true },
    ));
    expect(res.rawData.byteLength).toBe(extracted.byteLength);
    expect(res.rawData.every((val, i) => val == extracted[i])).toBe(true);
  }, 300000);

  test('The output should have framerate data', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      new Blob([document.querySelector('[type=file]').files[0]]),
      { browserMode: true },
    ));
    expect(res.timing.frameDuration).toBe(0.03336666666666667);
  });

  test('The output should contain the video duration', async () => {
    const res = await page.evaluate(() => GPMFExtract(
      new Blob([document.querySelector('[type=file]').files[0]]),
      { browserMode: true },
    ));
    expect(res.timing.videoDuration).toBe(12.078733333333334);
  });
});

{
  /// @see set gpmf-extract-large-file=/gopro/20200802/GH010368.MP4&&npm test
  const largeFilePath = process.env["gpmf-extract-large-file"];
  const optionalTest = largeFilePath ? test : test.skip;

  describe(`Testing the extracted raw data and timing from the path of the full length video: "${largeFilePath}"`, () => {
    optionalTest('The output should extracted', async() => {
      /** @type {import('puppeteer').Page} */
      const page = await global.__BROWSER__.newPage();
      await page.goto(`file://${join(__dirname, './browser/index.html')}`);
      /** @type {import('puppeteer').ElementHandle<HTMLInputElement>} */
      const inputHandle = await page.$('input[type=file]');
      await inputHandle.uploadFile(largeFilePath);

      const res = await page.evaluate(() => GPMFExtract(
        document.querySelector('[type=file]').files[0],
        {
          browserMode: true,
        },
      ));

      expect(res).toEqual(expect.anything());
      expect(res.rawData).toEqual(expect.anything());
    }, 30000);
  });
}
