---
title: "getInputValue()"
---

# getInputValue()

This function is used by memory classes to select the input value
to use for the memory. If there is only one input value, it is used.
If there are multiple input values, the inputKey must be specified.

> **getInputValue**(`inputValues`: `InputValues`, `inputKey`?: `string`): `any`

## Parameters

| Parameter     | Type          |
| :------------ | :------------ |
| `inputValues` | `InputValues` |
| `inputKey?`   | `string`      |

## Returns

`any`

## Defined in

[langchain/src/memory/base.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L25)
