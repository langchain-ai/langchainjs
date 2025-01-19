import { NotionAPILoader } from "@langchain/community/document_loaders/web/notionapi";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Loading a page (including child pages all as separate documents)
const pageLoader = new NotionAPILoader({
  clientOptions: {
    auth: "<NOTION_INTEGRATION_TOKEN>",
  },
  id: "<PAGE_ID>",
  type: "page",
});

const splitter = new RecursiveCharacterTextSplitter();

// Load the documents
const pageDocs = await pageLoader.load();
// Split the documents using the text splitter
const splitDocs = await splitter.splitDocuments(pageDocs);

console.log({ splitDocs });

// Loading a database (each row is a separate document with all properties as metadata)
const dbLoader = new NotionAPILoader({
  clientOptions: {
    auth: "<NOTION_INTEGRATION_TOKEN>",
  },
  id: "<DATABASE_ID>",
  type: "database",
  onDocumentLoaded: (current, total, currentTitle) => {
    console.log(`Loaded Page: ${currentTitle} (${current}/${total})`);
  },
  callerOptions: {
    maxConcurrency: 64, // Default value
  },
  propertiesAsHeader: true, // Prepends a front matter header of the page properties to the page contents
});

// A database row contents is likely to be less than 1000 characters so it's not split into multiple documents
const dbDocs = await dbLoader.load();

console.log({ dbDocs });
