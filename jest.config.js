var config = {
  projects: [
    {
      displayName: ' Node  ',
      runner: 'jest-runner',
      testMatch: ['**/node.test.js'],
    },
    {
      displayName: 'Browser',
      runner: 'jest-runner',
      preset: "jest-puppeteer",
      testMatch: ['**/browser.test.js'],
    },
  ],
};

module.exports = config;
