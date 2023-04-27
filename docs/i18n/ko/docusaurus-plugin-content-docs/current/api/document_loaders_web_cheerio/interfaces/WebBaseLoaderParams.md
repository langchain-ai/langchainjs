---
title: "WebBaseLoaderParams"
---

# WebBaseLoaderParams

## Hierarchy

- `AsyncCallerParams`.**WebBaseLoaderParams**

## Properties

### maxConcurrency?

> **maxConcurrency**: `number`

The maximum number of concurrent calls that can be made.
Defaults to `Infinity`, which means no limit.

#### Inherited from

AsyncCallerParams.maxConcurrency

#### Defined in

[langchain/src/util/async_caller.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L21)

### maxRetries?

> **maxRetries**: `number`

The maximum number of retries that can be made for a single call,
with an exponential backoff between each attempt. Defaults to 6.

#### Inherited from

AsyncCallerParams.maxRetries

#### Defined in

[langchain/src/util/async_caller.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/util/async_caller.ts#L26)

### selector?

> **selector**: `SelectorType`

The selector to use to extract the text from the document. Defaults to
"body".

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L17)

### timeout?

> **timeout**: `number`

The timeout in milliseconds for the fetch request. Defaults to 10s.

#### Defined in

[langchain/src/document_loaders/web/cheerio.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/document_loaders/web/cheerio.ts#L11)
