/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { VectaraRetriever } from "../vectara.js";
import { VectaraStore } from "../../vectorstores/vectara.js";

test("VectaraRetriever", async () => {
  const store = new VectaraStore({
    customer_id: process.env.VECTARA_CUSTOMER_ID ? parseInt(process.env.VECTARA_CUSTOMER_ID) : 0,
    corpus_id: process.env.VECTARA_CORPUS_ID ? parseInt(process.env.VECTARA_CORPUS_ID) : 0,
    api_key: process.env.VECTARA_API_KEY || "",
  });
  const retriever = new VectaraRetriever(store);

  const docs = await retriever.getRelevantDocuments("hello");

  expect(docs.length).toBeGreaterThan(0);

  console.log(docs);
});
