---
title: "PromptTemplate"
---

# PromptTemplate

Schema to represent a basic prompt for an LLM.

## Example

```ts
import { PromptTemplate } from "langchain/prompts";

const prompt = new PromptTemplate({
  inputVariables: ["foo"],
  template: "Say {foo}",
});
```

## Hierarchy

- [`BaseStringPromptTemplate`](BaseStringPromptTemplate.md).**PromptTemplate**

## Implements

- [`PromptTemplateInput`](../interfaces/PromptTemplateInput.md)

## Constructors

### constructor()

> **new PromptTemplate**(`input`: [`PromptTemplateInput`](../interfaces/PromptTemplateInput.md)): [`PromptTemplate`](PromptTemplate.md)

#### Parameters

| Parameter | Type                                                          |
| :-------- | :------------------------------------------------------------ |
| `input`   | [`PromptTemplateInput`](../interfaces/PromptTemplateInput.md) |

#### Returns

[`PromptTemplate`](PromptTemplate.md)

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[constructor](BaseStringPromptTemplate.md#constructor)

#### Defined in

[langchain/src/prompts/prompt.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L61)

## Properties

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Implementation of

[PromptTemplateInput](../interfaces/PromptTemplateInput.md).[inputVariables](../interfaces/PromptTemplateInput.md#inputvariables)

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[inputVariables](BaseStringPromptTemplate.md#inputvariables)

#### Defined in

[langchain/src/prompts/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L50)

### template

> **template**: `string`

The prompt template

#### Implementation of

[PromptTemplateInput](../interfaces/PromptTemplateInput.md).[template](../interfaces/PromptTemplateInput.md#template)

#### Defined in

[langchain/src/prompts/prompt.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L55)

### templateFormat

> **templateFormat**: [`TemplateFormat`](../types/TemplateFormat.md) = `"f-string"`

The format of the prompt template. Options are 'f-string', 'jinja-2'

#### Default Value

'f-string'

#### Implementation of

[PromptTemplateInput](../interfaces/PromptTemplateInput.md).[templateFormat](../interfaces/PromptTemplateInput.md#templateformat)

#### Defined in

[langchain/src/prompts/prompt.ts:57](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L57)

### validateTemplate

> **validateTemplate**: `boolean` = `true`

Whether or not to try validating the template on initialization

#### Default Value

`true`

#### Implementation of

[PromptTemplateInput](../interfaces/PromptTemplateInput.md).[validateTemplate](../interfaces/PromptTemplateInput.md#validatetemplate)

#### Defined in

[langchain/src/prompts/prompt.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L59)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

How to parse the output of calling an LLM on this formatted prompt

#### Implementation of

[PromptTemplateInput](../interfaces/PromptTemplateInput.md).[outputParser](../interfaces/PromptTemplateInput.md#outputparser)

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[outputParser](BaseStringPromptTemplate.md#outputparser)

#### Defined in

[langchain/src/prompts/base.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L52)

### partialVariables?

> **partialVariables**: [`InputValues`](../../schema/types/InputValues.md)

Partial variables

#### Implementation of

[PromptTemplateInput](../interfaces/PromptTemplateInput.md).[partialVariables](../interfaces/PromptTemplateInput.md#partialvariables)

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[partialVariables](BaseStringPromptTemplate.md#partialvariables)

#### Defined in

[langchain/src/prompts/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L54)

## Methods

### \_getPromptType()

Return the string type key uniquely identifying this class of prompt template.

> **\_getPromptType**(): "prompt"

#### Returns

"prompt"

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[\_getPromptType](BaseStringPromptTemplate.md#_getprompttype)

#### Defined in

[langchain/src/prompts/prompt.ts:80](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L80)

### format()

Format the prompt given the input values.

#### Example

```ts
prompt.format({ foo: "bar" });
```

> **format**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<`string`\>

#### Parameters

| Parameter | Type                                               | Description                                                    |
| :-------- | :------------------------------------------------- | :------------------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) | A dictionary of arguments to be passed to the prompt template. |

#### Returns

`Promise`<`string`\>

A formatted prompt string.

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[format](BaseStringPromptTemplate.md#format)

#### Defined in

[langchain/src/prompts/prompt.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L84)

### formatPromptValue()

Format the prompt given the input values and return a formatted prompt value.

> **formatPromptValue**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`BasePromptValue`](../../schema/classes/BasePromptValue.md)\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`BasePromptValue`](../../schema/classes/BasePromptValue.md)\>

A formatted PromptValue.

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[formatPromptValue](BaseStringPromptTemplate.md#formatpromptvalue)

#### Defined in

[langchain/src/prompts/base.ts:151](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L151)

### mergePartialAndUserVariables()

> **mergePartialAndUserVariables**(`userVariables`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`InputValues`](../../schema/types/InputValues.md)\>

#### Parameters

| Parameter       | Type                                               |
| :-------------- | :------------------------------------------------- |
| `userVariables` | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`InputValues`](../../schema/types/InputValues.md)\>

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[mergePartialAndUserVariables](BaseStringPromptTemplate.md#mergepartialanduservariables)

#### Defined in

[langchain/src/prompts/base.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L68)

### partial()

> **partial**(`values`: [`PartialValues`](../../schema/types/PartialValues.md)): `Promise`<[`PromptTemplate`](PromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `values`  | [`PartialValues`](../../schema/types/PartialValues.md) |

#### Returns

`Promise`<[`PromptTemplate`](PromptTemplate.md)\>

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[partial](BaseStringPromptTemplate.md#partial)

#### Defined in

[langchain/src/prompts/prompt.ts:141](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L141)

### serialize()

Return a json-like object representing this prompt template.

> **serialize**(): [`SerializedPromptTemplate`](../types/SerializedPromptTemplate.md)

#### Returns

[`SerializedPromptTemplate`](../types/SerializedPromptTemplate.md)

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[serialize](BaseStringPromptTemplate.md#serialize)

#### Defined in

[langchain/src/prompts/prompt.ts:153](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L153)

### deserialize()

Load a prompt template from a json-like object describing it.

#### Remarks

Deserializing needs to be async because templates (e.g. [FewShotPromptTemplate](FewShotPromptTemplate.md)) can
reference remote resources that we read asynchronously with a web
request.

> `Static` **deserialize**(`data`: [`SerializedPromptTemplate`](../types/SerializedPromptTemplate.md)): `Promise`<[`PromptTemplate`](PromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                               |
| :-------- | :----------------------------------------------------------------- |
| `data`    | [`SerializedPromptTemplate`](../types/SerializedPromptTemplate.md) |

#### Returns

`Promise`<[`PromptTemplate`](PromptTemplate.md)\>

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[deserialize](BaseStringPromptTemplate.md#deserialize)

#### Defined in

[langchain/src/prompts/prompt.ts:167](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L167)

### fromExamples()

Take examples in list format with prefix and suffix to create a prompt.

Intendend to be used a a way to dynamically create a prompt from examples.

> `Static` **fromExamples**(`examples`: `string`[], `suffix`: `string`, `inputVariables`: `string`[], `exampleSeparator`: `string` = `"\n\n"`, `prefix`: `string` = `""`): [`PromptTemplate`](PromptTemplate.md)

#### Parameters

| Parameter          | Type       | Default value | Description                                                                        |
| :----------------- | :--------- | :------------ | :--------------------------------------------------------------------------------- |
| `examples`         | `string`[] | `undefined`   | List of examples to use in the prompt.                                             |
| `suffix`           | `string`   | `undefined`   | String to go after the list of examples. Should generally set up the user's input. |
| `inputVariables`   | `string`[] | `undefined`   | A list of variable names the final prompt template will expect                     |
| `exampleSeparator` | `string`   | `"\n\n"`      | The separator to use in between examples                                           |
| `prefix`           | `string`   | `""`          | String that should go before any examples. Generally includes examples.            |

#### Returns

[`PromptTemplate`](PromptTemplate.md)

The final prompt template generated.

#### Defined in

[langchain/src/prompts/prompt.ts:102](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L102)

### fromTemplate()

Load prompt template from a template f-string

> `Static` **fromTemplate**(`template`: `string`, «destructured»: `Omit`<[`PromptTemplateInput`](../interfaces/PromptTemplateInput.md), "template" \| "inputVariables"\> = `{}`): [`PromptTemplate`](PromptTemplate.md)

#### Parameters

| Parameter        | Type                                                                                                    |
| :--------------- | :------------------------------------------------------------------------------------------------------ |
| `template`       | `string`                                                                                                |
| `«destructured»` | `Omit`<[`PromptTemplateInput`](../interfaces/PromptTemplateInput.md), "template" \| "inputVariables"\> |

#### Returns

[`PromptTemplate`](PromptTemplate.md)

#### Defined in

[langchain/src/prompts/prompt.ts:119](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L119)
