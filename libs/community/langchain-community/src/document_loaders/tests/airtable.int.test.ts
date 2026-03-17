/**
 * NOTE: AIRTABLE_API_TOKEN should be set in environment variables
 */
import { Document } from "@langchain/core/documents";
import { AirtableLoader } from "../web/airtable.js";

describe("AirtableLoader Integration Tests", () => {
  // Ensure that the environment variables are set

  const baseId = "BASE_ID";
  const tableId = "TABLE_ID";

  // Integration tests for the load method
  describe("load", () => {
    it("should load documents from Airtable", async () => {
      const loader = new AirtableLoader({ tableId, baseId });

      const documents = await loader.load();

      expect(documents).toBeDefined();
      expect(documents.length).toBeGreaterThan(0);

      documents.forEach((doc) => {
        expect(doc).toBeInstanceOf(Document);
        expect(doc.pageContent).toBeDefined();
        expect(doc.metadata).toMatchObject({
          source: `${baseId}_${tableId}`,
          base_id: baseId,
          table_id: tableId,
        });
      });
    }, 20000);
  });

  // Integration tests for the loadLazy method
  describe("loadLazy", () => {
    it("should lazily load documents from Airtable", async () => {
      const loader = new AirtableLoader({ tableId, baseId });

      const documents: Document[] = [];
      for await (const doc of loader.loadLazy()) {
        documents.push(doc);
      }

      expect(documents).toBeDefined();
      expect(documents.length).toBeGreaterThan(0);

      documents.forEach((doc) => {
        expect(doc).toBeInstanceOf(Document);
        expect(doc.pageContent).toBeDefined();
        expect(doc.metadata).toMatchObject({
          source: `${baseId}_${tableId}`,
          base_id: baseId,
          table_id: tableId,
        });
      });
    }, 20000);
  });
});
