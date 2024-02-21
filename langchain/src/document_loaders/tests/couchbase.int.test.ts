import { test, expect } from "@jest/globals";
import { Cluster } from "couchbase";
import { CouchbaseDocumentLoader } from "../web/couchbase.js";

test("Test Couchbase Cluster connection ", async () => {
  const connectionString = "<enter-valid-couchbase-connection-string>";
  const databaseUsername = "<enter-valid-couchbase-user>";
  const databasePassword = "<enter-valid-couchbase-password>";
  const query = `
    SELECT h.* FROM \`travel-sample\`.inventory.hotel h 
    WHERE h.country = 'United States'
    LIMIT 10
  `;
  const validPageContentFields = ["country", "name", "description"];
  const validMetadataFields = ["id"];

  const couchbaseClient = await Cluster.connect(connectionString, {
    username: databaseUsername,
    password: databasePassword,
    configProfile: "wanDevelopment",
  });
  const loader = new CouchbaseDocumentLoader(
    couchbaseClient,
    query,
    validPageContentFields,
    validMetadataFields
  );
  const docs = await loader.load();
  expect(docs.length).toBeGreaterThan(0);

  for (const doc of docs) {
    expect(doc.pageContent).not.toBe(""); // Assuming valid page content fields
    expect(doc.metadata).toHaveProperty("id"); // Assuming metadata has id field
    expect(doc.metadata.id).not.toBe("");
  }
});
