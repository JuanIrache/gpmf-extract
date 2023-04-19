const NodeEnvironment = require('jest-environment-node');

class PuppeteerEnvironment extends NodeEnvironment {
  async setup() {
    console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    await super.setup();
  }
}

module.exports = PuppeteerEnvironment
