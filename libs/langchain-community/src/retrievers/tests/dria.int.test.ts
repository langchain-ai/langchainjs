import { test, expect } from "@jest/globals";
import { DriaRetriever } from "../dria.js";

test.skip("DriaRetriever", async () => {
  // contract of TypeScript Handbook v4.9 uploaded to Dria
  // https://dria.co/knowledge/-B64DjhUtCwBdXSpsRytlRQCu-bie-vSTvTIT8Ap3g0
  const contractId = "-B64DjhUtCwBdXSpsRytlRQCu-bie-vSTvTIT8Ap3g0";
  const topK = 10;

  const retriever = new DriaRetriever({ contractId, topK });

  const docs = await retriever.getRelevantDocuments("What is a union type?");
  expect(docs.length).toBe(topK);

  // console.log(docs[0].pageContent);
});
