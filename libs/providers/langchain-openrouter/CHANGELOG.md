# @langchain/openrouter

## 0.1.4

### Patch Changes

- [#10106](https://github.com/langchain-ai/langchainjs/pull/10106) [`9f30267`](https://github.com/langchain-ai/langchainjs/commit/9f30267e95a2a42fac71f1d3674b84c5a190dbbc) Thanks [@hntrl](https://github.com/hntrl)! - Add package version metadata to runnable traces. Each package now stamps its version in `this.metadata.versions` at construction time, making version info available in LangSmith trace metadata.

- [#10156](https://github.com/langchain-ai/langchainjs/pull/10156) [`511d39d`](https://github.com/langchain-ai/langchainjs/commit/511d39d18846cdde2ae94678f5c1cf0ad3477079) Thanks [@kanweiwei](https://github.com/kanweiwei)! - fix(openrouter): pass stream chunks to handleLLMNewToken callback

- [#10106](https://github.com/langchain-ai/langchainjs/pull/10106) [`9f30267`](https://github.com/langchain-ai/langchainjs/commit/9f30267e95a2a42fac71f1d3674b84c5a190dbbc) Thanks [@hntrl](https://github.com/hntrl)! - Add string model constructor overload for ChatOpenRouter, e.g. `new ChatOpenRouter("openai/gpt-4o-mini", { apiKey: "..." })`.

- Updated dependencies [[`9f30267`](https://github.com/langchain-ai/langchainjs/commit/9f30267e95a2a42fac71f1d3674b84c5a190dbbc), [`f298a9b`](https://github.com/langchain-ai/langchainjs/commit/f298a9bdedff7bc2b0eb7f6b5e6b52fd3042a7b7)]:
  - @langchain/openai@1.2.11

## 0.1.3

### Patch Changes

- Updated dependencies [[`62ba83e`](https://github.com/langchain-ai/langchainjs/commit/62ba83edd5206c86d8da8d1b608a2493ee4f3da8)]:
  - @langchain/openai@1.2.10

## 0.1.2

### Patch Changes

- [#10109](https://github.com/langchain-ai/langchainjs/pull/10109) [`630890a`](https://github.com/langchain-ai/langchainjs/commit/630890a1f5b4a85054b2d0cfab41e8780da5e91e) Thanks [@hntrl](https://github.com/hntrl)! - feat(openrouter): default OpenRouter attribution headers

  `ChatOpenRouter` now sends `HTTP-Referer` and `X-Title` headers by default for OpenRouter app attribution. `siteUrl` defaults to `"https://docs.langchain.com/oss"` and `siteName` defaults to `"langchain"`. Users can still override both values.

## 0.1.1

### Patch Changes

- Updated dependencies [[`b583729`](https://github.com/langchain-ai/langchainjs/commit/b583729e99cf0c035630f6b311c4d069a1980cca)]:
  - @langchain/openai@1.2.9
