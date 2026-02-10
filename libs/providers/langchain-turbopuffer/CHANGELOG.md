# @langchain/turbopuffer

## 0.1.1

### Patch Changes

- [#9786](https://github.com/langchain-ai/langchainjs/pull/9786) [`8ee833c`](https://github.com/langchain-ai/langchainjs/commit/8ee833c1fb99891565832ead4990e246b30022a6) Thanks [@SkrOYC](https://github.com/SkrOYC)! - fix: resolve flaky tests and configuration issues
  - @langchain/turbopuffer: Allow tests to pass when no test files are found (vitest --passWithNoTests)
  - @langchain/model-profiles: Fix broken import path in generator test
  - @langchain/classic: Fix AutoGPTPrompt test to be locale-independent by forcing en-US locale

## 0.1.0

### Minor Changes

- [#9681](https://github.com/langchain-ai/langchainjs/pull/9681) [`9bdd109`](https://github.com/langchain-ai/langchainjs/commit/9bdd109b2078828ddf55e7665caa9891f108f69c) Thanks [@robertmaybin](https://github.com/robertmaybin)! - Add @langchain/turbopuffer package for turbopuffer vector database integration

  Deprecate @langchain/community/vectorstores/turbopuffer in favor of @langchain/turbopuffer
