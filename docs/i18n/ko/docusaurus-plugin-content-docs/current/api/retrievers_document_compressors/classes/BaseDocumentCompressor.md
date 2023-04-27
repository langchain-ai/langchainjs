---
title: "BaseDocumentCompressor"
---

# BaseDocumentCompressor

Base Document Compression class. All compressors should extend this class.

## Constructors

### constructor()

> **new BaseDocumentCompressor**(): [`BaseDocumentCompressor`](BaseDocumentCompressor.md)

#### Returns

[`BaseDocumentCompressor`](BaseDocumentCompressor.md)

## Methods

### compressDocuments()

> `Abstract` **compressDocuments**(`documents`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `query`: `string`): `Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Parameters

| Parameter   | Type                                                                              |
| :---------- | :-------------------------------------------------------------------------------- |
| `documents` | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `query`     | `string`                                                                          |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[]\>

#### Defined in

[langchain/src/retrievers/document_compressors/index.ts:7](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/retrievers/document_compressors/index.ts#L7)
