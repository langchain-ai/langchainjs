/**
 * This mock is necessary because `langchain-core` (CJS) imports `p-retry` (ESM).
 * Jest struggles to transform the ESM `p-retry` inside `node_modules` when required by CJS code,
 * causing "Must use import to load ES Module" errors.
 * This mock provides a CJS-compatible implementation of `p-retry` to bypass the issue.
 */
module.exports = async function pRetry(input, options) {
  const retries = options.retries ?? 3;
  const onFailedAttempt = options.onFailedAttempt;

  for (let i = 0; i <= retries; i++) {
    try {
      return await input(i + 1);
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      if (onFailedAttempt) {
        await onFailedAttempt({
          error,
          attemptNumber: i + 1,
          retriesLeft: retries - i,
        });
      }
    }
  }
};
module.exports.default = module.exports;
