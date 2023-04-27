---
title: "SupabaseLibArgs"
---

# SupabaseLibArgs

## Properties

### client

> **client**: `default`<`any`, "public", `any`\>

#### Defined in

[langchain/src/retrievers/supabase.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L26)

### keywordK?

> **keywordK**: `number`

The number of documents to return from the keyword search. Defaults to 2.

#### Defined in

[langchain/src/retrievers/supabase.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L46)

### keywordQueryName?

> **keywordQueryName**: `string`

The name of the Keyword search function on Supabase. Defaults to "kw_match_documents".

#### Defined in

[langchain/src/retrievers/supabase.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L38)

### similarityK?

> **similarityK**: `number`

The number of documents to return from the similarity search. Defaults to 2.

#### Defined in

[langchain/src/retrievers/supabase.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L42)

### similarityQueryName?

> **similarityQueryName**: `string`

The name of the Similarity search function on Supabase. Defaults to "match_documents".

#### Defined in

[langchain/src/retrievers/supabase.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L34)

### tableName?

> **tableName**: `string`

The table name on Supabase. Defaults to "documents".

#### Defined in

[langchain/src/retrievers/supabase.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/supabase.ts#L30)
