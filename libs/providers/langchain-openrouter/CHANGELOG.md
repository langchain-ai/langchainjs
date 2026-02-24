# @langchain/openrouter

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
