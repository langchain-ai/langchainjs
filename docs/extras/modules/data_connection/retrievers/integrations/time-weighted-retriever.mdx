# Time-Weighted Retriever

A Time-Weighted Retriever is a retriever that takes into account recency in addition to similarity. The scoring algorithm is:

```typescript
let score = (1.0 - this.decayRate) ** hoursPassed + vectorRelevance;
```

Notably, `hoursPassed` above refers to the time since the object in the retriever was last accessed, not since it was created. This means that frequently accessed objects remain "fresh" and score higher.

`this.decayRate` is a configurable decimal number between 0 and 1. A lower number means that documents will be "remembered" for longer, while a higher number strongly weights more recently accessed documents.

Note that setting a decay rate of exactly 0 or 1 makes `hoursPassed` irrelevant and makes this retriever equivalent to a standard vector lookup.

## Usage

This example shows how to intialize a `TimeWeightedVectorStoreRetriever` with a vector store.
It is important to note that due to required metadata, all documents must be added to the backing vector store using the `addDocuments` method on the **retriever**, not the vector store itself.

import CodeBlock from "@theme/CodeBlock";
import Example from "@examples/retrievers/time-weighted-retriever.ts";

<CodeBlock language="typescript">{Example}</CodeBlock>
