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
}

module.exports = PQueue;
module.exports.default = PQueue;

