module.exports = async function pRetry(input, options) {
  // Simple pass-through for tests. 
  // Most tests mocking external services won't need actual retries.
  return input(1);
};
module.exports.default = module.exports;

