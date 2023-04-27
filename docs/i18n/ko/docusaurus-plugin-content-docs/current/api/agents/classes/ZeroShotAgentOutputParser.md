---
title: "ZeroShotAgentOutputParser"
---

# ZeroShotAgentOutputParser

## Hierarchy

- [`AgentActionOutputParser`](AgentActionOutputParser.md).**ZeroShotAgentOutputParser**

## Constructors

### constructor()

> **new ZeroShotAgentOutputParser**(`fields`?: [`OutputParserArgs`](../types/OutputParserArgs.md)): [`ZeroShotAgentOutputParser`](ZeroShotAgentOutputParser.md)

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `fields?` | [`OutputParserArgs`](../types/OutputParserArgs.md) |

#### Returns

[`ZeroShotAgentOutputParser`](ZeroShotAgentOutputParser.md)

#### Overrides

[AgentActionOutputParser](AgentActionOutputParser.md).[constructor](AgentActionOutputParser.md#constructor)

#### Defined in

[langchain/src/agents/mrkl/outputParser.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/outputParser.ts#L10)

## Properties

### finishToolName

> **finishToolName**: `string`

#### Defined in

[langchain/src/agents/mrkl/outputParser.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/outputParser.ts#L8)

## Methods

### \_type()

Return the string type key uniquely identifying this class of parser

> **\_type**(): `string`

#### Returns

`string`

#### Inherited from

[AgentActionOutputParser](AgentActionOutputParser.md).[\_type](AgentActionOutputParser.md#_type)

#### Defined in

[langchain/src/schema/output_parser.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L38)

### getFormatInstructions()

Return a string describing the format of the output.

#### Example

```json
{
  "foo": "bar"
}
```

> **getFormatInstructions**(): `string`

#### Returns

`string`

Format instructions.

#### Overrides

[AgentActionOutputParser](AgentActionOutputParser.md).[getFormatInstructions](AgentActionOutputParser.md#getformatinstructions)

#### Defined in

[langchain/src/agents/mrkl/outputParser.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/outputParser.ts#L37)

### parse()

Parse the output of an LLM call.

> **parse**(`text`: `string`): `Promise`<\{`log`: `string`;
> `returnValues`: \{`output`: `string`;};
> `tool`?: `undefined`;
> `toolInput`?: `undefined`;} \| \{`log`: `string`;
> `tool`: `string`;
> `toolInput`: `string`;
> `returnValues`?: `undefined`;}\>

#### Parameters

| Parameter | Type     | Description          |
| :-------- | :------- | :------------------- |
| `text`    | `string` | LLM output to parse. |

#### Returns

`Promise`<\{`log`: `string`;
`returnValues`: \{`output`: `string`;};
`tool`?: `undefined`;
`toolInput`?: `undefined`;} \| \{`log`: `string`;
`tool`: `string`;
`toolInput`: `string`;
`returnValues`?: `undefined`;}\>

Parsed output.

#### Overrides

[AgentActionOutputParser](AgentActionOutputParser.md).[parse](AgentActionOutputParser.md#parse)

#### Defined in

[langchain/src/agents/mrkl/outputParser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/mrkl/outputParser.ts#L15)

### parseWithPrompt()

> **parseWithPrompt**(`text`: `string`, `_prompt`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Parameters

| Parameter    | Type                                                         |
| :----------- | :----------------------------------------------------------- |
| `text`       | `string`                                                     |
| `_prompt`    | [`BasePromptValue`](../../schema/classes/BasePromptValue.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)            |

#### Returns

`Promise`<[`AgentAction`](../../schema/types/AgentAction.md) \| [`AgentFinish`](../../schema/types/AgentFinish.md)\>

#### Inherited from

[AgentActionOutputParser](AgentActionOutputParser.md).[parseWithPrompt](AgentActionOutputParser.md#parsewithprompt)

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)
