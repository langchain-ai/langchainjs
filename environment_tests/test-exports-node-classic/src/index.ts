import assert from "assert";

// Test imports from langchain
import { createAgent, initChatModel, BaseMessage, tool } from "langchain";

// Test imports from @langchain/core
import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

async function test() {
  // Test that types are imported correctly from langchain
  assert(typeof createAgent === "function");
  assert(typeof initChatModel === "function");
  assert(typeof BaseMessage === "function");
  assert(typeof tool === "function");

  // Test that types are imported correctly from @langchain/core
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof Document === "function");
  assert(typeof StringOutputParser === "function");
  assert(typeof RunnableSequence === "function");

  // Test that we can instantiate some of these classes
  const parser = new StringOutputParser();
  assert(parser !== null);

  const doc = new Document({
    pageContent: "test content",
    metadata: {},
  });
  assert(doc.pageContent === "test content");

  console.log("All imports successful with moduleResolution: node");
}

test()
  .then(() => {
    console.log("✓ Test passed");
    process.exit(0);
  })
  .catch((e) => {
    console.error("✗ Test failed:", e);
    process.exit(1);
  });
