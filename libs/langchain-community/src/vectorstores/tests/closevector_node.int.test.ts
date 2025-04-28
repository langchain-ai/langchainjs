import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CloseVectorNode } from "../closevector/node.js";

test.skip("Test CloseVectorNode.fromTexts + addVectors", async () => {
  const key = getEnvironmentVariable("CLOSEVECTOR_API_KEY");
  const secret = getEnvironmentVariable("CLOSEVECTOR_API_SECRET");

  if (!key || !secret) {
    throw new Error("CLOSEVECTOR_API_KEY or CLOSEVECTOR_API_SECRET not set");
  }

  const vectorStore = await CloseVectorNode.fromTexts(
    ["Hello world"],
    [{ id: 2 }],
    new OpenAIEmbeddings(),
    undefined,
    {
      key,
      secret,
    }
  );
  expect(vectorStore.instance.index?.getMaxElements()).toBe(1);
  expect(vectorStore.instance.index?.getCurrentCount()).toBe(1);

  await vectorStore.saveToCloud({
    description: "test",
    public: true,
  });

  const { uuid } = vectorStore.instance;

  const vectorStore2 = await CloseVectorNode.loadFromCloud({
    uuid,
    embeddings: new OpenAIEmbeddings(),
    credentials: {
      key,
      secret,
    },
  });

  expect(vectorStore2.instance.index?.getMaxElements()).toBe(1);
});
