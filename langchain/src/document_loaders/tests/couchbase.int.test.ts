import { test, expect } from "@jest/globals";
import { Cluster } from "couchbase";
import { CouchbaseDocumentLoader } from "../web/couchbase.js";

test("Test Couchbase Cluster connection ", async () => {
  const couchbaseClient = await Cluster.connect("couchbase://localhost", {
    username: "Administrator",
    password: "password",
  });
  const loader = new CouchbaseDocumentLoader(
    couchbaseClient,
    "Select r.* from `travel-sample`.`inventory`.`route` as r limit 10",
    ["airline", "sourceairport"]
  );
  const doc = await loader.load();
  console.log(doc);
  expect(doc.length).toBeGreaterThan(0);
});
