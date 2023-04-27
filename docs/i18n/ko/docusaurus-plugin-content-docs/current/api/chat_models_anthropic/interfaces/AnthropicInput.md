---
title: "AnthropicInput"
---

# AnthropicInput

Input to AnthropicChat class.

## Properties

### maxTokensToSample

> **maxTokensToSample**: `number`

A maximum number of tokens to generate before stopping.

#### Defined in

[langchain/src/chat_models/anthropic.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L61)

### modelName

> **modelName**: `string`

Model name to use

#### Defined in

[langchain/src/chat_models/anthropic.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L76)

### apiKey?

> **apiKey**: `string`

Anthropic API key

#### Defined in

[langchain/src/chat_models/anthropic.ts:73](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L73)

### invocationKwargs?

> **invocationKwargs**: `Kwargs`

Holds any additional parameters that are valid to pass to [`anthropic.complete`](https://console.anthropic.com/docs/api/reference) that are not explicitly specified on this class.

#### Defined in

[langchain/src/chat_models/anthropic.ts:82](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L82)

### stopSequences?

> **stopSequences**: `string`[]

A list of strings upon which to stop generating.
You probably want `["\n\nHuman:"]`, as that's the cue for
the next turn in the dialog agent.

#### Defined in

[langchain/src/chat_models/anthropic.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L67)

### streaming?

> **streaming**: `boolean`

Whether to stream the results or not

#### Defined in

[langchain/src/chat_models/anthropic.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L70)

### temperature?

> **temperature**: `number`

Amount of randomness injected into the response. Ranges
from 0 to 1. Use temp closer to 0 for analytical /
multiple choice, and temp closer to 1 for creative
and generative tasks.

#### Defined in

[langchain/src/chat_models/anthropic.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L42)

### topK?

> **topK**: `number`

Only sample from the top K options for each subsequent
token. Used to remove "long tail" low probability
responses. Defaults to -1, which disables it.

#### Defined in

[langchain/src/chat_models/anthropic.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L48)

### topP?

> **topP**: `number`

Does nucleus sampling, in which we compute the
cumulative distribution over all the options for each
subsequent token in decreasing probability order and
cut it off once it reaches a particular probability
specified by top_p. Defaults to -1, which disables it.
Note that you should either alter temperature or top_p,
but not both.

#### Defined in

[langchain/src/chat_models/anthropic.ts:58](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chat_models/anthropic.ts#L58)
