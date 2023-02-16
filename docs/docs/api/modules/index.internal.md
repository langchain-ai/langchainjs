---
id: "index.internal"
title: "Module: internal"
sidebar_label: "internal"
custom_edit_url: null
---

## Classes

- [BaseOutputParser](../classes/.internal.BaseOutputParser)

## Interfaces

- [LLMChainInput](../interfaces/.internal.LLMChainInput)
- [ModelParams](../interfaces/.internal.ModelParams)
- [OpenAIInput](../interfaces/.internal.OpenAIInput)

## Type Aliases

### Kwargs

Ƭ **Kwargs**: `Record`<`string`, `any`\>

#### Defined in

[llms/openai.ts:82](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/openai.ts#L82)

___

### SerializedCommaSeparatedListOutputParser

Ƭ **SerializedCommaSeparatedListOutputParser**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `_type` | ``"comma_separated_list"`` |

#### Defined in

[prompt/parser.ts:51](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/parser.ts#L51)

___

### SerializedOutputParser

Ƭ **SerializedOutputParser**: [`SerializedRegexParser`](.internal#serializedregexparser) \| [`SerializedCommaSeparatedListOutputParser`](.internal#serializedcommaseparatedlistoutputparser)

#### Defined in

[prompt/parser.ts:1](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/parser.ts#L1)

___

### SerializedRegexParser

Ƭ **SerializedRegexParser**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `_type` | ``"regex_parser"`` |
| `default_output_key?` | `string` |
| `output_keys` | `string`[] |
| `regex` | `string` |

#### Defined in

[prompt/parser.ts:77](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/parser.ts#L77)

___

### TemplateFormat

Ƭ **TemplateFormat**: ``"f-string"`` \| ``"jinja2"``

#### Defined in

[prompt/template.ts:3](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/template.ts#L3)
