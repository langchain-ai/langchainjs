/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { VectaraRetriever } from "../vectara.js";
import { VectaraStore } from "../../vectorstores/vectara.js";

/**
 * Steps to run this test:
 * 1. Create a Vectara account at https://vectara.com/
 * 2. Create a corpus
 * 3. Upload a specific document to the corpus (e.g. the US constitution)
 * 4. Set the appropriate environment variables (VECTARA_CUSTOMER_ID, VECTARA_CORPUS_ID, VECTARA_API_KEY)
 * 5. Run the test
 */

test("VectaraRetriever (with filter)", async () => {
  const store = new VectaraStore({
    customer_id: process.env.VECTARA_CUSTOMER_ID ? parseInt(process.env.VECTARA_CUSTOMER_ID) : 0,
    corpus_id: process.env.VECTARA_CORPUS_ID ? parseInt(process.env.VECTARA_CORPUS_ID) : 0,
    api_key: process.env.VECTARA_API_KEY || "",
  });
  const retriever = new VectaraRetriever(store);

  // If you've uploaded the US constituion, this will return the relevant section
  const docs = await retriever.getRelevantDocuments("Article 1 Section 7");

  expect(docs.length).toBeGreaterThan(0);
  // This checks that the document contains the relevant section
  expect(docs[0].pageContent).toContain('All Bills for raising Revenue shall originate in the House of Representatives');

  console.log(docs);
});

test("VectaraRetriever (without filter)", async () => {
  const store = new VectaraStore({
    customer_id: process.env.VECTARA_CUSTOMER_ID ? parseInt(process.env.VECTARA_CUSTOMER_ID) : 0,
    corpus_id: process.env.VECTARA_CORPUS_ID ? parseInt(process.env.VECTARA_CORPUS_ID) : 0,
    api_key: process.env.VECTARA_API_KEY || "",
  });
  const retriever = new VectaraRetriever(store);

  const docs = await retriever.getRelevantDocuments("hello");

  expect(docs.length).toBeGreaterThan(0);
});