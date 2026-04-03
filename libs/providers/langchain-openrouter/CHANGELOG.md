# @langchain/openrouter

## 0.2.0

### Minor Changes

- [#10559](https://github.com/langchain-ai/langchainjs/pull/10559) [`17aedaa`](https://github.com/langchain-ai/langchainjs/commit/17aedaabfca680a9f8bb8f858395ee1ee4f152a1) Thanks [@mdrxy](https://github.com/mdrxy)! - Add `appCategories` field for OpenRouter marketplace attribution (`X-OpenRouter-Categories` header) and update default `siteUrl`/`siteName` values. Attribution headers are now only sent when set.

### Patch Changes

- Updated dependencies [[`d6bf4fc`](https://github.com/langchain-ai/langchainjs/commit/d6bf4fc91b2c2eb931bf3bc7606b1817632bc8c1)]:
  - @langchain/openai@1.4.2

## 0.1.10

### Patch Changes

- Updated dependencies [[`9270c48`](https://github.com/langchain-ai/langchainjs/commit/9270c48d7a95db6e7e2570a7e681c94479a673d0)]:
  - @langchain/openai@1.4.1

## 0.1.9

### Patch Changes

- Updated dependencies [[`5552999`](https://github.com/langchain-ai/langchainjs/commit/555299917c90322e25d7671bad2e20c9b104bad6)]:
  - @langchain/openai@1.4.0

## 0.1.8

### Patch Changes

- Updated dependencies [[`478652c`](https://github.com/langchain-ai/langchainjs/commit/478652c01cdae0703415febd250b6c2656b36410), [`52e501b`](https://github.com/langchain-ai/langchainjs/commit/52e501b44ee54ace1889ec9149a3617c4409db51)]:
  - @langchain/openai@1.3.1

## 0.1.7

### Patch Changes

- Updated dependencies [[`af9bbd3`](https://github.com/langchain-ai/langchainjs/commit/af9bbd3f48d96de8963f492ebbf75ca0762f7e57)]:
  - @langchain/openai@1.3.0

## 0.1.6

### Patch Changes

- Updated dependencies [[`aacbe87`](https://github.com/langchain-ai/langchainjs/commit/aacbe872014a6e089c188336520d91dcac2f0287)]:
  - @langchain/openai@1.2.13

## 0.1.5

### Patch Changes

- [#10215](https://github.com/langchain-ai/langchainjs/pull/10215) [`a68d354`](https://github.com/langchain-ai/langchainjs/commit/a68d354bc3557e990241d2cbfe36bfb9dcb11d14) Thanks [@colifran](https://github.com/colifran)! - feat(openrouter): implement standard schema support for structured output

- Updated dependencies [[`3682a8d`](https://github.com/langchain-ai/langchainjs/commit/3682a8d4e0ed0855a5283f26bcfd1c0415dde075)]:
  - @langchain/openai@1.2.12

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
