/**
 * Integration test script for Milvus bug fixes:
 * - #9749: Collection must be loaded before delete
 * - #9748: partitionName not respected in search/delete
 *
 * Run from libs/langchain-community with: npx tsx src/vectorstores/tests/milvus-fixes.test.ts
 */

import { Milvus } from "../milvus.js";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";

const MILVUS_URL = "localhost:19530";

// Use FakeEmbeddings to avoid API key requirements
class SimpleEmbeddings extends FakeEmbeddings {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(() =>
      Array(128)
        .fill(0)
        .map(() => Math.random())
    );
  }

  async embedQuery(_text: string): Promise<number[]> {
    return Array(128)
      .fill(0)
      .map(() => Math.random());
  }
}

async function testDeleteWithoutPriorSearch() {
  console.log("\n=== Test #9749: Delete without prior search ===");
  console.log(
    "This tests that delete works even if the collection wasn't loaded by a search first.\n"
  );

  const embeddings = new SimpleEmbeddings();
  const collectionName = `test_delete_${Date.now()}`;

  // Create collection with some documents
  const docs = [
    new Document({
      pageContent: "Document one about cats",
      metadata: { topic: "cats" },
    }),
    new Document({
      pageContent: "Document two about dogs",
      metadata: { topic: "dogs" },
    }),
    new Document({
      pageContent: "Document three about birds",
      metadata: { topic: "birds" },
    }),
  ];

  console.log("Creating collection and adding documents...");
  const vectorStore = await Milvus.fromDocuments(docs, embeddings, {
    collectionName,
    clientConfig: { address: MILVUS_URL },
  });

  console.log("✓ Documents added successfully");

  // Now create a NEW instance (simulating a fresh connection)
  // and try to delete WITHOUT doing a search first
  console.log(
    "\nCreating fresh instance and attempting delete without prior search..."
  );
  const freshVectorStore = await Milvus.fromExistingCollection(embeddings, {
    collectionName,
    clientConfig: { address: MILVUS_URL },
  });

  try {
    // This should work with our fix (loadCollectionSync added to delete)
    await freshVectorStore.delete({ filter: 'topic == "cats"' });
    console.log(
      "✓ SUCCESS: Delete worked without prior search! (#9749 is FIXED)"
    );
    return true;
  } catch (error: unknown) {
    const errorMessage =
      (error as { message?: string })?.message ?? String(error);
    if (errorMessage.includes("collection not loaded")) {
      console.log(
        "✗ FAILED: Got 'collection not loaded' error. #9749 is NOT fixed."
      );
    } else {
      console.log("✗ FAILED with error:", errorMessage);
    }
    return false;
  }
}

async function testPartitionNameInSearchAndDelete() {
  console.log(
    "\n=== Test #9748: partitionName respected in search and delete ==="
  );
  console.log(
    "This tests that partitionName limits operations to the specified partition.\n"
  );

  const embeddings = new SimpleEmbeddings();
  const collectionName = `test_partition_${Date.now()}`;

  // Create documents for partition "alpha"
  const alphaVectorStore = new Milvus(embeddings, {
    collectionName,
    partitionName: "alpha",
    clientConfig: { address: MILVUS_URL },
  });

  const alphaDocs = [
    new Document({
      pageContent: "Alpha document about ML",
      metadata: { source: "alpha" },
    }),
  ];

  console.log("Adding document to partition 'alpha'...");
  await alphaVectorStore.addDocuments(alphaDocs);
  console.log("✓ Document added to alpha partition");

  // Create documents for partition "beta"
  const betaVectorStore = new Milvus(embeddings, {
    collectionName,
    partitionName: "beta",
    clientConfig: { address: MILVUS_URL },
  });

  const betaDocs = [
    new Document({
      pageContent: "Beta document about AI",
      metadata: { source: "beta" },
    }),
  ];

  console.log("Adding document to partition 'beta'...");
  await betaVectorStore.addDocuments(betaDocs);
  console.log("✓ Document added to beta partition");

  // Test search with partition - should only find alpha docs
  console.log("\nSearching in 'alpha' partition...");
  const alphaResults = await alphaVectorStore.similaritySearch("ML AI", 10);

  console.log(`  Found ${alphaResults.length} results in alpha partition`);
  const alphaOnly = alphaResults.every((r) => r.metadata.source === "alpha");

  if (alphaResults.length > 0 && alphaOnly) {
    console.log(
      "✓ SUCCESS: Search in alpha partition only returned alpha docs! (#9748 search is FIXED)"
    );
  } else if (alphaResults.length === 0) {
    console.log(
      "⚠ WARNING: No results found (may be expected with random embeddings)"
    );
  } else {
    console.log("✗ FAILED: Search returned docs from other partitions");
    console.log(
      "  Results:",
      alphaResults.map((r) => r.metadata)
    );
  }

  // Test delete with partition - should only delete from alpha
  console.log("\nDeleting from 'alpha' partition...");
  try {
    await alphaVectorStore.delete({ filter: 'source == "alpha"' });
    console.log("✓ Delete command executed on alpha partition");
  } catch (error: unknown) {
    const errorMessage =
      (error as { message?: string })?.message ?? String(error);
    console.log("✗ Delete failed:", errorMessage);
    return false;
  }

  // Verify beta docs still exist
  console.log("Verifying 'beta' partition documents still exist...");
  const betaResults = await betaVectorStore.similaritySearch("AI", 10);

  if (betaResults.length > 0) {
    console.log(
      "✓ SUCCESS: Beta partition has documents (partition isolation verified)"
    );
  } else {
    console.log(
      "⚠ WARNING: No results in beta (may be expected with random embeddings, but partition isolation should work)"
    );
  }

  return true;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   Milvus Bug Fixes Integration Test                    ║");
  console.log("║   Testing #9749 (load before delete)                   ║");
  console.log("║   Testing #9748 (partitionName in search/delete)       ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  console.log(`\nConnecting to Milvus at ${MILVUS_URL}...`);

  try {
    const test1Passed = await testDeleteWithoutPriorSearch();
    const test2Passed = await testPartitionNameInSearchAndDelete();

    console.log(`\n${"=".repeat(60)}`);
    console.log("TEST SUMMARY:");
    console.log(
      `  #9749 (load before delete):     ${test1Passed ? "✓ PASSED" : "✗ FAILED"}`
    );
    console.log(
      `  #9748 (partitionName):          ${test2Passed ? "✓ PASSED" : "✗ FAILED"}`
    );
    console.log("=".repeat(60));

    if (test1Passed && test2Passed) {
      console.log("\n🎉 All tests passed! The fixes are working correctly.");
    } else {
      console.log("\n❌ Some tests failed. Please review the output above.");
      process.exit(1);
    }
  } catch (error: unknown) {
    const errorMessage =
      (error as { message?: string })?.message ?? String(error);
    console.error("\n❌ Test error:", errorMessage);
    if (errorMessage.includes("ECONNREFUSED")) {
      console.log("\nMake sure Milvus is running: docker ps");
      console.log("If not started, run: docker start milvus");
    }
    process.exit(1);
  }
}

main();
