---
"@langchain/mongodb": minor
---

feat(mongodb): add VoyageEmbeddings, migrated from @langchain/community

`VoyageEmbeddings` is now exported directly from `@langchain/mongodb`. It was previously
available via `@langchain/community/embeddings/voyage`, which has been removed from this
monorepo.

**Migration:** update your import path:

```ts
// before
import { VoyageEmbeddings } from "@langchain/community/embeddings/voyage";

// after
import { VoyageEmbeddings } from "@langchain/mongodb";
```

Note: the default model has been updated from `voyage-01` (retired) to `voyage-3`. If you
rely on the default, re-embed any existing indexes after migrating.
