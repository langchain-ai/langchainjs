---
title: "SerializedAgentT<TType, FromLLMInput, ConstructorInput>"
---

# SerializedAgentT<TType, FromLLMInput, ConstructorInput\>

> **SerializedAgentT**: <`TType`, `FromLLMInput`, `ConstructorInput`\> \{`_type`: `TType`;
> `llm_chain`?: [`SerializedLLMChain`](../../chains/types/SerializedLLMChain.md);} & \{`load_from_llm_and_tools`: true;} & `FromLLMInput` \| \{`load_from_llm_and_tools`?: false;} & `ConstructorInput`

## Type parameters

- `TType` _extends_ `string` = `string`
- `FromLLMInput` _extends_ `Record`<`string`, `unknown`\> = `Record`<`string`, `unknown`\>
- `ConstructorInput` _extends_ [`AgentInput`](../interfaces/AgentInput.md) = [`AgentInput`](../interfaces/AgentInput.md)

## Defined in

[langchain/src/agents/types.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/types.ts#L18)
