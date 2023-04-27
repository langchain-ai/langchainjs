---
title: "SerializedChatVectorDBQAChain"
---

# SerializedChatVectorDBQAChain

> **SerializedChatVectorDBQAChain**: `object`

## Type declaration

| Member                    | Type                                            |
| :------------------------ | :---------------------------------------------- |
| `_type`                   | "chat-vector-db"                                |
| `combine_documents_chain` | [`SerializedBaseChain`](SerializedBaseChain.md) |
| `k`                       | `number`                                        |
| `question_generator`      | [`SerializedLLMChain`](SerializedLLMChain.md)   |

## Defined in

[langchain/src/chains/serde.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/serde.ts#L40)
