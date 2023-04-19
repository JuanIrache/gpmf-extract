const puppeteer = require('puppeteer');

module.exports = async function() {
  console.log('Setup Puppeteer');
  console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  const debug = false;
  const browser = await puppeteer.launch({
    headless: debug,
    devtools: !debug,
  });
  // This global is not available inside tests but only in global teardown
  global.__BROWSER_GLOBAL__ = browser;
}
