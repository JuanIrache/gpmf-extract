module.exports = class InlineWorker {
  constructor(factory) {
    const url = URL.createObjectURL(new Blob(['(' + factory.toString() + ')(self);'], { type: 'text/javascript' }));
    try {
      const worker = new Worker(url);
      const terminate = worker.terminate.bind(worker);
      worker.terminate = () => {
        try { terminate(); }
        finally { URL.revokeObjectURL(url); }
      };
      return worker;
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
};
