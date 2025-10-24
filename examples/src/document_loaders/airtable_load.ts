import { AirtableLoader } from "@langchain/community/document_loaders/web/airtable";
import { Document } from "@langchain/core/documents";

// Default airtable loader
const loader = new AirtableLoader({
  tableId: "YOUR_TABLE_ID",
  baseId: "YOUR_BASE_ID",
});

try {
  const documents: Document[] = await loader.load();
  console.log("Loaded documents:", documents);
} catch (error) {
  console.error("Error loading documents:", error);
}

// Lazy airtable loader
const loaderLazy = new AirtableLoader({
  tableId: "YOUR_TABLE_ID",
  baseId: "YOUR_BASE_ID",
});

try {
  console.log("Lazily loading documents:");
  for await (const document of loader.loadLazy()) {
    console.log("Loaded document:", document);
  }
} catch (error) {
  console.error("Error loading documents lazily:", error);
}

// Airtable loader with specific view
const loaderView = new AirtableLoader({
  tableId: "YOUR_TABLE_ID",
  baseId: "YOUR_BASE_ID",
  kwargs: { view: "YOUR_VIEW_NAME" },
});

try {
  const documents: Document[] = await loader.load();
  console.log("Loaded documents with view:", documents);
} catch (error) {
  console.error("Error loading documents with view:", error);
}
