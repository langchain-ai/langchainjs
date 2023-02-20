# Embeddings

Embeddings can be used to create a numerical representation of textual data. This numerical representation is useful because it can be used to find similar documents.

Below is an example of how to use the OpenAI embeddings. Embeddings occasionally have different embedding methods for queries versus documents, so the embedding class exposes a `embedQuery` and `embedDocuments` method.

```typescript
import { OpenAIEmbeddings } from "langchain/embeddings";

/* Embed queries */
const embeddings = new OpenAIEmbeddings();
const res = await embeddings.embedQuery("Hello world");

/* Embed documents */
const documentRes = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
```
