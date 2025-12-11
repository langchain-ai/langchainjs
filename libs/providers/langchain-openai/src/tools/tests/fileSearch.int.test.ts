import fs from "node:fs";
import OpenAI from "openai";

import { expect, it, describe, beforeAll, afterAll } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { tools } from "../index.js";
import { ChatOpenAI } from "../../chat_models/index.js";

const openai = new OpenAI();

async function createFile(filePath: string) {
  let result;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    // Download the file content from the URL
    const res = await fetch(filePath);
    const buffer = await res.arrayBuffer();
    const urlParts = filePath.split("/");
    const fileName = urlParts[urlParts.length - 1];
    const file = new File([buffer], fileName);
    result = await openai.files.create({
      file: file,
      purpose: "assistants",
    });
  } else {
    // Handle local file path
    const fileContent = fs.createReadStream(filePath);
    result = await openai.files.create({
      file: fileContent,
      purpose: "assistants",
    });
  }
  return result.id;
}

async function waitForFileProcessing(
  vectorStoreId: string,
  fileId: string,
  maxWaitMs = 60000
) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const file = await openai.vectorStores.files.retrieve(fileId, {
      vector_store_id: vectorStoreId,
    });
    if (file.status === "completed") {
      return;
    }
    if (file.status === "failed") {
      throw new Error(`File processing failed: ${file.last_error?.message}`);
    }
    // Wait 1 second before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("File processing timed out");
}

let vectorStoreId: string;
let fileId: string;

beforeAll(
  async () => {
    // 1. Upload the file
    fileId = await createFile(
      "https://cdn.openai.com/API/docs/deep_research_blog.pdf"
    );

    console.log("fileId", fileId);

    // 2. Create a vector store
    const vectorStore = await openai.vectorStores.create({
      name: "langchain-test-vector-store",
    });
    vectorStoreId = vectorStore.id;

    // 3. Add the file to the vector store
    const file = await openai.vectorStores.files.create(vectorStoreId, {
      file_id: fileId,
    });

    console.log("file", file);

    // 4. Wait for file processing to complete
    await waitForFileProcessing(vectorStoreId, fileId);
  },
  60 * 1000 // 60 seconds
);

afterAll(async () => {
  // Cleanup: delete vector store and file
  try {
    if (vectorStoreId) {
      await openai.vectorStores.delete(vectorStoreId);
    }
    if (fileId) {
      await openai.files.delete(fileId);
    }
  } catch {
    // Ignore cleanup errors
  }
});

describe("OpenAI File Search Tool Integration Tests", () => {
  it("fileSearch retrieves information from a vector store", async () => {
    const llm = new ChatOpenAI({ model: "gpt-4.1" });
    const llmWithFileSearch = llm.bindTools([
      tools.fileSearch({
        vectorStoreIds: [vectorStoreId],
      }),
    ]);

    const response = await llmWithFileSearch.invoke([
      new HumanMessage("What is deep research by OpenAI?"),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.text).toContain("Deep research");
  });

  it("fileSearch works with max results limit", async () => {
    const llm = new ChatOpenAI({ model: "gpt-4.1" });
    const llmWithFileSearch = llm.bindTools([
      tools.fileSearch({
        vectorStoreIds: [vectorStoreId],
        maxNumResults: 3,
      }),
    ]);

    const response = await llmWithFileSearch.invoke([
      new HumanMessage("What can deep research do?"),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(response.text).toContain("Deep research");
  });
});
