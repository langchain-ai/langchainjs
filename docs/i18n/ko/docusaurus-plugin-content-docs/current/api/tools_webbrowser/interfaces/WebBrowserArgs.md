---
title: "WebBrowserArgs"
---

# WebBrowserArgs

## Hierarchy

- [`ToolParams`](../../tools/interfaces/ToolParams.md).**WebBrowserArgs**

## Properties

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Defined in

[langchain/src/tools/webbrowser.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/webbrowser.ts#L135)

### model

> **model**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

#### Defined in

[langchain/src/tools/webbrowser.ts:133](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/webbrowser.ts#L133)

### axiosConfig?

> **axiosConfig**: `Omit`<`AxiosRequestConfig`<`any`\>, "url"\>

#### Defined in

[langchain/src/tools/webbrowser.ts:139](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/webbrowser.ts#L139)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

#### Defined in

[langchain/src/tools/webbrowser.ts:142](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/webbrowser.ts#L142)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[ToolParams](../../tools/interfaces/ToolParams.md).[callbacks](../../tools/interfaces/ToolParams.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### headers?

> **headers**: `Headers`

#### Defined in

[langchain/src/tools/webbrowser.ts:137](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/webbrowser.ts#L137)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[ToolParams](../../tools/interfaces/ToolParams.md).[verbose](../../tools/interfaces/ToolParams.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
