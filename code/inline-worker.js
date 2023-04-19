module.exports = class InlineWorker {
  constructor(
    /** @type {() => any} */
    func,
    /** @type {any} */
    self = { },
  ) {
    if (Worker && Blob && URL) {
      const functionBody = func.toString().trim().match(
        /^function\s*\w*\s*\([\w\s,='"`]*\)\s*{([\w\W]*?)}$/
      )[1];

      return new Worker(URL.createObjectURL(
        new Blob([ functionBody ], { type: "text/javascript" })
      ));
    }

    this.self = self;
    this.self.postMessage = function postMessage(data) {
      setTimeout(() => this.self.onmessage({ data: data }), 0);
    };

    setTimeout(func.bind(self, self), 0);
  }

  postMessage(data) {
    setTimeout(() => this.self.onmessage({ data: data }), 0);
  }
};
