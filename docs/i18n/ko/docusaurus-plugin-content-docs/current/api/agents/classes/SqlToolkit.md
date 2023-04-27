---
title: "SqlToolkit"
---

# SqlToolkit

## Hierarchy

- [`Toolkit`](Toolkit.md).**SqlToolkit**

## Constructors

### constructor()

> **new SqlToolkit**(`db`: [`SqlDatabase`](../../sql_db/classes/SqlDatabase.md)): [`SqlToolkit`](SqlToolkit.md)

#### Parameters

| Parameter | Type                                                 |
| :-------- | :--------------------------------------------------- |
| `db`      | [`SqlDatabase`](../../sql_db/classes/SqlDatabase.md) |

#### Returns

[`SqlToolkit`](SqlToolkit.md)

#### Overrides

[Toolkit](Toolkit.md).[constructor](Toolkit.md#constructor)

#### Defined in

[langchain/src/agents/agent_toolkits/sql/sql.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/sql/sql.ts#L29)

## Properties

### db

> **db**: [`SqlDatabase`](../../sql_db/classes/SqlDatabase.md)

#### Defined in

[langchain/src/agents/agent_toolkits/sql/sql.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/sql/sql.ts#L25)

### dialect

> **dialect**: `string` = `"sqlite"`

#### Defined in

[langchain/src/agents/agent_toolkits/sql/sql.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/sql/sql.ts#L27)

### tools

> **tools**: [`Tool`](../../tools/classes/Tool.md)[]

#### Overrides

[Toolkit](Toolkit.md).[tools](Toolkit.md#tools)

#### Defined in

[langchain/src/agents/agent_toolkits/sql/sql.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/sql/sql.ts#L23)
