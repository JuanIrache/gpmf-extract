var config = {
  projects: [
    {
      displayName: 'Node',
      browser: false,
      runner: 'jest-runner',
      testMatch: ['**/node.test.js'],
    },
    {
      displayName: 'Browser',
      runner: 'jest-runner',
      testMatch: ['**/browser.test.js'],
      preset: "jest-puppeteer",
    },
  ],
};

module.exports = config;
