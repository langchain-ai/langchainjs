import { test, expect } from "@jest/globals";
import { Cluster } from "couchbase";
import { CouchbaseDocumentLoader } from "../web/couchbase.js";


test("Test Couchbase Cluster connection ", async ()=>{
    const couchbaseClient = await Cluster.connect("");
    const loader = new CouchbaseDocumentLoader(couchbaseClient, "");
    const doc = await loader.load();
    console.log(doc);
    expect(doc.length).toBeGreaterThan(0);
})