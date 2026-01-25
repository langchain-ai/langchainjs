class PQueue {
  constructor(options) {
    this.options = options;
  }
  add(fn) {
    return fn();
  }
  on(event, listener) {
    // no-op
    return this;
  }
  onIdle() {
    // returns a promise that resolves immediately
    return Promise.resolve();
  }
}

module.exports = PQueue;
module.exports.default = PQueue;

