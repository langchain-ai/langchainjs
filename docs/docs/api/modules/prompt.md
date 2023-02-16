---
id: "prompt"
title: "Module: prompt"
sidebar_label: "prompt"
sidebar_position: 0
custom_edit_url: null
---

## Modules

- [internal](prompt.internal.md)

## Interfaces

- [BasePromptTemplateInput](../interfaces/prompt.BasePromptTemplateInput.md)
- [FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md)
- [PromptTemplateInput](../interfaces/prompt.PromptTemplateInput.md)

## References

### BasePromptTemplate

Re-exports [BasePromptTemplate](../classes/.BasePromptTemplate)

___

### FewShotPromptTemplate

Re-exports [FewShotPromptTemplate](../classes/.FewShotPromptTemplate)

___

### PromptTemplate

Re-exports [PromptTemplate](../classes/.PromptTemplate)

## Type Aliases

### InputValues

Ƭ **InputValues**: `Record`<`string`, `any`\>

#### Defined in

[prompt/base.ts:11](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L11)

___

### SerializedBasePromptTemplate

Ƭ **SerializedBasePromptTemplate**: `ReturnType`<`InstanceType`<typeof [`templateClasses`](prompt.internal.md#templateclasses)[`number`]\>[``"serialize"``]\>

#### Defined in

[prompt/base.ts:6](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L6)

___

### SerializedFewShotTemplate

Ƭ **SerializedFewShotTemplate**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `_type` | ``"few_shot"`` |
| `example_prompt?` | [`SerializedPromptTemplate`](prompt.md#serializedprompttemplate) |
| `example_prompt_path?` | `string` |
| `example_separator` | `string` |
| `examples` | `string` \| [`Example`](prompt.internal.md#example)[] |
| `input_variables` | `string`[] |
| `output_parser?` | [`SerializedOutputParser`](.internal#serializedoutputparser) |
| `prefix?` | `string` |
| `prefix_path?` | `string` |
| `suffix?` | `string` |
| `suffix_path?` | `string` |
| `template_format` | [`TemplateFormat`](.internal#templateformat) |

#### Defined in

[prompt/few_shot.ts:21](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L21)

___

### SerializedPromptTemplate

Ƭ **SerializedPromptTemplate**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `_type?` | ``"prompt"`` |
| `input_variables` | `string`[] |
| `output_parser?` | [`SerializedOutputParser`](.internal#serializedoutputparser) |
| `template?` | `string` |
| `template_format?` | [`TemplateFormat`](.internal#templateformat) |
| `template_path?` | `string` |

#### Defined in

[prompt/prompt.ts:15](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L15)

## Functions

### loadPrompt

▸ **loadPrompt**(`uri`): `Promise`<[`BasePromptTemplate`](../classes/.BasePromptTemplate)\>

Load a prompt from [LangchainHub](https://github.com/hwchase17/langchain-hub) or local filesystem.

**`Example`**

Loading from LangchainHub:
```ts
import { loadPrompt } from "langchain/prompt";
const prompt = await loadPrompt("lc://prompts/hello-world/prompt.yaml");
```

**`Example`**

Loading from local filesystem:
```ts
import { loadPrompt } from "langchain/prompt";
const prompt = await loadPrompt("/path/to/prompt.json");
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `uri` | `string` |

#### Returns

`Promise`<[`BasePromptTemplate`](../classes/.BasePromptTemplate)\>

#### Defined in

[prompt/load.ts:25](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/load.ts#L25)
