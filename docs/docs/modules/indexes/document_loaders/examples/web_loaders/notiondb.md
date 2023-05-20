---
hide_table_of_contents: true
---

# Notion DB

This example goes over how to load data from a Notion Database
To load data, you will need the `integrationToken` of the Notion integration and the `databaseId` of the pages you want to access. Make sure to add your integration to the database.

```typescript
import { NotionDBLoader } from "langchain/document_loaders/web/notiondb";

const loader = new NotionDBLoader({
  integrationToken: "NOTION_TOKEN",
  databaseId: "databaseId",
});
const docs = await loader.load();
```
