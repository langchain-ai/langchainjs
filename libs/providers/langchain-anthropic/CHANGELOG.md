# @langchain/anthropic

## 1.3.7

### Patch Changes

- Updated dependencies [[`23be5af`](https://github.com/langchain-ai/langchainjs/commit/23be5afd59b5f4806edef11937ce5e2ba300f7ee)]:
  - @langchain/core@1.1.12

## 1.3.6

### Patch Changes

- Updated dependencies [[`a46a249`](https://github.com/langchain-ai/langchainjs/commit/a46a24983fd0fea649d950725a2673b3c435275f)]:
  - @langchain/core@1.1.11

## 1.3.5

### Patch Changes

- Updated dependencies [[`817fc9a`](https://github.com/langchain-ai/langchainjs/commit/817fc9a56d4699f3563a6e153b13eadf7bcc661b)]:
  - @langchain/core@1.1.10

## 1.3.4

### Patch Changes

- Updated dependencies [[`56600b9`](https://github.com/langchain-ai/langchainjs/commit/56600b94f8e185f44d4288b7a9b66c55778938dd), [`dc5c2ac`](https://github.com/langchain-ai/langchainjs/commit/dc5c2ac00f86dd2feeba9843d708926a5f38202e), [`c28d24a`](https://github.com/langchain-ai/langchainjs/commit/c28d24a8770f6d0e543cde116b0e38b3baf21301), [`bfcb87d`](https://github.com/langchain-ai/langchainjs/commit/bfcb87d23c580c7881f650960a448fe2e54a30b3)]:
  - @langchain/core@1.1.9

## 1.3.3

### Patch Changes

- Updated dependencies [[`e5063f9`](https://github.com/langchain-ai/langchainjs/commit/e5063f9c6e9989ea067dfdff39262b9e7b6aba62), [`8996647`](https://github.com/langchain-ai/langchainjs/commit/89966470e8c0b112ce4f9a326004af6a4173f9e6)]:
  - @langchain/core@1.1.8

## 1.3.2

### Patch Changes

- Updated dependencies [[`df9c42b`](https://github.com/langchain-ai/langchainjs/commit/df9c42b3ab61b85309ab47256e1d93c3188435ee), [`8d2982b`](https://github.com/langchain-ai/langchainjs/commit/8d2982bb94c0f4e4314ace3cc98a1ae87571b1ed), [`af664be`](https://github.com/langchain-ai/langchainjs/commit/af664becc0245b2315ea2f784c9a6c1d7622dbb4), [`ffb2402`](https://github.com/langchain-ai/langchainjs/commit/ffb24026cd93e58219519ee24c6e23ea57cb5bde)]:
  - @langchain/core@1.1.7

## 1.3.1

### Patch Changes

- [#9669](https://github.com/langchain-ai/langchainjs/pull/9669) [`5068787`](https://github.com/langchain-ai/langchainjs/commit/50687872ad9f8cf83f42ca6130dd603527ec5402) Thanks [@hntrl](https://github.com/hntrl)! - set empty tool array in invocation params

- Updated dependencies [[`a7b2a7d`](https://github.com/langchain-ai/langchainjs/commit/a7b2a7db5ef57df3731ae6c9931f4b663e909505), [`a496c5f`](https://github.com/langchain-ai/langchainjs/commit/a496c5fc64d94cc0809216325b0f1bfde3f92c45), [`1da1325`](https://github.com/langchain-ai/langchainjs/commit/1da1325aea044fb37af54a9de1f4ae0b9f47d4a2)]:
  - @langchain/core@1.1.6

## 1.3.0

### Minor Changes

- [#9540](https://github.com/langchain-ai/langchainjs/pull/9540) [`ece5c09`](https://github.com/langchain-ai/langchainjs/commit/ece5c09f461e6bcc93142e8f8c07316743e28d76) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named text editor tool

- [#9588](https://github.com/langchain-ai/langchainjs/pull/9588) [`e9a7adc`](https://github.com/langchain-ai/langchainjs/commit/e9a7adca29dab5f1af47bbf7492d5cdebf9675fe) Thanks [@yu-iskw](https://github.com/yu-iskw)! - Expose `ChatAnthropicInput` type for improved type safety and user experience.

  This change introduces a new exported type `ChatAnthropicInput` which is an intersection of `AnthropicInput` and `BaseChatModelParams`. This allows LangChain users to define and pass ChatAnthropic configuration options with full type safety and IntelliSense.

### Patch Changes

- [#9539](https://github.com/langchain-ai/langchainjs/pull/9539) [`12305b4`](https://github.com/langchain-ai/langchainjs/commit/12305b4327f41e60110c72d74c82e12ee27d20a5) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(anthropic): support tool search tool

- [#9614](https://github.com/langchain-ai/langchainjs/pull/9614) [`97de9af`](https://github.com/langchain-ai/langchainjs/commit/97de9afbe7ebaffb7c0b2682a80bf1e9c2187536) Thanks [@iltenahmet](https://github.com/iltenahmet)! - fix(anthropic): Fix `.js` import issue in `chat_models.ts`

- [#9538](https://github.com/langchain-ai/langchainjs/pull/9538) [`4836f6c`](https://github.com/langchain-ai/langchainjs/commit/4836f6c48d8f04ca99c59a27d5a9bf876a6ad805) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named webfetch tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`a0d2d6c`](https://github.com/langchain-ai/langchainjs/commit/a0d2d6cad0455e24f94282d43210030580c7d26a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named computer use tool

- [#9541](https://github.com/langchain-ai/langchainjs/pull/9541) [`34547f5`](https://github.com/langchain-ai/langchainjs/commit/34547f5933a296a7423773e6d1fdd1022ff4936e) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add named mcp toolset tool

- Updated dependencies [[`005c729`](https://github.com/langchain-ai/langchainjs/commit/005c72903bcdf090e0f4c58960c8c243481f9874), [`ab78246`](https://github.com/langchain-ai/langchainjs/commit/ab782462753e6c3ae5d55c0c251f795af32929d5), [`8cc81c7`](https://github.com/langchain-ai/langchainjs/commit/8cc81c7cee69530f7a6296c69123edbe227b2fce), [`f32e499`](https://github.com/langchain-ai/langchainjs/commit/f32e4991d0e707324e3f6af287a1ee87ab833b7e), [`a28d83d`](https://github.com/langchain-ai/langchainjs/commit/a28d83d49dd1fd31e67b52a44abc70f2cc2a2026), [`2e5ad70`](https://github.com/langchain-ai/langchainjs/commit/2e5ad70d16c1f13eaaea95336bbe2ec4a4a4954a), [`e456c66`](https://github.com/langchain-ai/langchainjs/commit/e456c661aa1ab8f1ed4a98c40616f5a13270e88e), [`1cfe603`](https://github.com/langchain-ai/langchainjs/commit/1cfe603e97d8711343ae5f1f5a75648e7bd2a16e)]:
  - @langchain/core@1.1.5

## 1.2.3

### Patch Changes

- Updated dependencies [[`0bade90`](https://github.com/langchain-ai/langchainjs/commit/0bade90ed47c7988ed86f1e695a28273c7b3df50), [`6c40d00`](https://github.com/langchain-ai/langchainjs/commit/6c40d00e926f377d249c2919549381522eac8ed1)]:
  - @langchain/core@1.1.4

## 1.2.2

### Patch Changes

- [#9520](https://github.com/langchain-ai/langchainjs/pull/9520) [`cc022b0`](https://github.com/langchain-ai/langchainjs/commit/cc022b0aab2c3959a5036b8d1b9d6ce0b547200e) Thanks [@yukukotani](https://github.com/yukukotani)! - Includes cache creation/read tokens in input_tokens of usage metadata

- Updated dependencies [[`bd2c46e`](https://github.com/langchain-ai/langchainjs/commit/bd2c46e09e661d9ac766c09e71bc6687d6fc811c), [`487378b`](https://github.com/langchain-ai/langchainjs/commit/487378bf14277659c8ca0ef06ea0f9836b818ff4), [`138e7fb`](https://github.com/langchain-ai/langchainjs/commit/138e7fb6280705457079863bedb238b16b322032)]:
  - @langchain/core@1.1.3

## 1.2.1

### Patch Changes

- Updated dependencies [[`833f578`](https://github.com/langchain-ai/langchainjs/commit/833f57834dc3aa64e4cfdd7499f865b2ab41462a)]:
  - @langchain/core@1.1.2

## 1.2.0

### Minor Changes

- [#9531](https://github.com/langchain-ai/langchainjs/pull/9531) [`38f0162`](https://github.com/langchain-ai/langchainjs/commit/38f0162b7b2db2be2c3a75ae468728adcb49fdfb) Thanks [@hntrl](https://github.com/hntrl)! - support advanced tool use

### Patch Changes

- Updated dependencies [[`636b994`](https://github.com/langchain-ai/langchainjs/commit/636b99459bf843362298866211c63a7a15c2a319), [`38f0162`](https://github.com/langchain-ai/langchainjs/commit/38f0162b7b2db2be2c3a75ae468728adcb49fdfb)]:
  - @langchain/core@1.1.1

## 1.1.3

### Patch Changes

- [#9488](https://github.com/langchain-ai/langchainjs/pull/9488) [`cfee39a`](https://github.com/langchain-ai/langchainjs/commit/cfee39a0b867e8cd4ae7bda3d64bba4124be4e10) Thanks [@hntrl](https://github.com/hntrl)! - add opus-4.5 to model strings

## 1.1.2

### Patch Changes

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

## 1.1.1

### Patch Changes

- [#9451](https://github.com/langchain-ai/langchainjs/pull/9451) [`b1deda2`](https://github.com/langchain-ai/langchainjs/commit/b1deda21363b5a1a3f2b7bd77dc1d74764304666) Thanks [@hntrl](https://github.com/hntrl)! - fix betas being passed to client when streaming

## 1.1.0

### Minor Changes

- [#9424](https://github.com/langchain-ai/langchainjs/pull/9424) [`f17b2c9`](https://github.com/langchain-ai/langchainjs/commit/f17b2c9db047fab2d1db2d9aa791ec220cc9dd0a) Thanks [@hntrl](https://github.com/hntrl)! - add support for `betas` param

- [#9424](https://github.com/langchain-ai/langchainjs/pull/9424) [`f17b2c9`](https://github.com/langchain-ai/langchainjs/commit/f17b2c9db047fab2d1db2d9aa791ec220cc9dd0a) Thanks [@hntrl](https://github.com/hntrl)! - add support for native structured output

### Patch Changes

- [#9424](https://github.com/langchain-ai/langchainjs/pull/9424) [`f17b2c9`](https://github.com/langchain-ai/langchainjs/commit/f17b2c9db047fab2d1db2d9aa791ec220cc9dd0a) Thanks [@hntrl](https://github.com/hntrl)! - bump sdk version

## 1.0.1

### Patch Changes

- [#9387](https://github.com/langchain-ai/langchainjs/pull/9387) [`ac0d4fe`](https://github.com/langchain-ai/langchainjs/commit/ac0d4fe3807e05eb2185ae8a36da69498e6163d4) Thanks [@hntrl](https://github.com/hntrl)! - Add `ModelProfile` and `.profile` properties to ChatModel

## 1.0.0

This release updates the package for compatibility with LangChain v1.0. See the v1.0 [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for details on what's new.

## 0.3.31

### Patch Changes

- 51f638e: fix content management param

## 0.3.30

### Patch Changes

- 6c7eb84: fix sonnet-4.5 thinking

## 0.3.29

### Patch Changes

- 93493ee: add support for context management
- 93493ee: add support for memory server tools
- 93493ee: add default init options for sonnet-4.5

## 0.3.28

### Patch Changes

- 9ed7dfa: fix unhandled tool choice 'none'

## 0.3.27

### Patch Changes

- 49c242c: fix opus 4.1 topP error when streaming
