import { NotionAPILoader } from "langchain/document_loaders/web/notionapi";

// Loading a page (including child pages all as separate documents)
const pageLoader = new NotionAPILoader({
  clientOptions: {
    auth: "<NOTION_INTEGRATION_TOKEN>",
  },
  id: "<PAGE_ID>",
  type: "page",
});

// A page contents is likely to be more than 1000 characters so it's split into multiple documents (important for vectorization)
const pageDocs = await pageLoader.loadAndSplit();

console.log({ pageDocs });

// Loading a database (each row is a separate document with all properties as metadata)
const dbLoader = new NotionAPILoader({
  clientOptions: {
    auth: "<NOTION_INTEGRATION_TOKEN>",
  },
  id: "<DATABASE_ID>",
  type: "database",
});

// A database row contents is likely to be less than 1000 characters so it's not split into multiple documents
const dbDocs = await dbLoader.load();

console.log({ dbDocs });
