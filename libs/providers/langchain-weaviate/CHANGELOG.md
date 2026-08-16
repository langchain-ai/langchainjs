# @langchain/weaviate

## 1.1.0

### Minor Changes

- [#10785](https://github.com/langchain-ai/langchainjs/pull/10785) [`1160784`](https://github.com/langchain-ai/langchainjs/commit/1160784032bce394e6bb2e93f41ba9e09f812517) Thanks [@dudanogueira](https://github.com/dudanogueira)! - feat(weaviate): add jsonSchema support via createFromJson and upgrade client to v3.13.0

## 1.0.3

### Patch Changes

- [#10872](https://github.com/langchain-ai/langchainjs/pull/10872) [`a640079`](https://github.com/langchain-ai/langchainjs/commit/a64007997a4940f51bba3c1c83dae89d1ccfb692) Thanks [@hntrl](https://github.com/hntrl)! - chore(deps): remove redundant @types/uuid declarations

  Remove `@types/uuid` from package manifests that rely on `@langchain/core/utils/uuid` or do not require uuid type stubs directly, and refresh the lockfile entries accordingly.

## 1.0.2

### Patch Changes

- [#10776](https://github.com/langchain-ai/langchainjs/pull/10776) [`20a9abe`](https://github.com/langchain-ai/langchainjs/commit/20a9abea23ffacf4ae8dc9a7aeec217143bbdeb6) Thanks [@hntrl](https://github.com/hntrl)! - fix(deps): remediate uuid vulnerability by removing direct uuid usage

## 1.0.1

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.
