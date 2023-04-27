---
title: "ZapierToolKit"
---

# ZapierToolKit

## Hierarchy

- [`Toolkit`](Toolkit.md).**ZapierToolKit**

## Constructors

### constructor()

> **new ZapierToolKit**(): [`ZapierToolKit`](ZapierToolKit.md)

#### Returns

[`ZapierToolKit`](ZapierToolKit.md)

#### Inherited from

[Toolkit](Toolkit.md).[constructor](Toolkit.md#constructor)

## Properties

### tools

> **tools**: [`Tool`](../../tools/classes/Tool.md)[] = `[]`

#### Overrides

[Toolkit](Toolkit.md).[tools](Toolkit.md#tools)

#### Defined in

[langchain/src/agents/agent_toolkits/zapier/zapier.ts:6](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/zapier/zapier.ts#L6)

## Methods

### fromZapierNLAWrapper()

> `Static` **fromZapierNLAWrapper**(`zapierNLAWrapper`: [`ZapierNLAWrapper`](../../tools/classes/ZapierNLAWrapper.md)): `Promise`<[`ZapierToolKit`](ZapierToolKit.md)\>

#### Parameters

| Parameter          | Type                                                          |
| :----------------- | :------------------------------------------------------------ |
| `zapierNLAWrapper` | [`ZapierNLAWrapper`](../../tools/classes/ZapierNLAWrapper.md) |

#### Returns

`Promise`<[`ZapierToolKit`](ZapierToolKit.md)\>

#### Defined in

[langchain/src/agents/agent_toolkits/zapier/zapier.ts:8](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/zapier/zapier.ts#L8)
