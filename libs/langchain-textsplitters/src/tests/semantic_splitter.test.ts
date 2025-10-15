import { describe, expect, test } from "vitest";
import { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";
import { SemanticChunker, combineSentences, calculateCosineDistances } from "../semantic_splitter.js";

// Mock embeddings class for testing
class MockEmbeddings implements Embeddings {
  private embeddingMap: Map<string, number[]> = new Map();
  caller: any;
  
  constructor(embeddingMap?: Map<string, number[]>) {
    if (embeddingMap) {
      this.embeddingMap = embeddingMap;
    }
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((doc) => {
      // If we have a specific embedding for this text, use it
      if (this.embeddingMap.has(doc)) {
        return this.embeddingMap.get(doc)!;
      }
      
      // Otherwise, generate a simple embedding based on text characteristics
      const words = doc.toLowerCase().split(/\s+/);
      const embedding = new Array(10).fill(0);
      
      // Create embeddings that are more similar for semantically related content
      words.forEach(word => {
        if (word.includes("dog") || word.includes("cat") || word.includes("pet")) {
          embedding[0] += 1; // Animal topic
        }
        if (word.includes("run") || word.includes("walk") || word.includes("jump")) {
          embedding[1] += 1; // Movement topic
        }
        if (word.includes("happy") || word.includes("sad") || word.includes("angry")) {
          embedding[2] += 1; // Emotion topic
        }
        if (word.includes("car") || word.includes("drive") || word.includes("road")) {
          embedding[3] += 1; // Vehicle topic
        }
        if (word.includes("eat") || word.includes("food") || word.includes("hungry")) {
          embedding[4] += 1; // Food topic
        }
        // Add some variation
        embedding[5] = words.length / 10;
        embedding[6] = doc.length / 100;
      });
      
      // Normalize the embedding
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
    });
  }

  async embedQuery(document: string): Promise<number[]> {
    const embeddings = await this.embedDocuments([document]);
    return embeddings[0];
  }
}

describe("SemanticChunker", () => {
  test("Test semantic splitting with similar sentences", async () => {
    const text = "My dog loves to run. My cat loves to jump. I drive my car to work. I ride my bike to school.";
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 1,
      breakpointThresholdType: "percentile",
      breakpointThresholdAmount: 50, // Lower threshold to force more splits
    });
    
    const chunks = await splitter.splitText(text);
    
    // Should split into at least 2 chunks (pets vs transportation)
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.join(" ")).toEqual(text); // All content should be preserved
  });

  test("Test semantic splitting with single sentence", async () => {
    const text = "This is a single sentence.";
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 1,
    });
    
    const chunks = await splitter.splitText(text);
    
    // Single sentence should not be split
    expect(chunks).toEqual([text]);
  });

  test("Test semantic splitting with gradient threshold for two sentences", async () => {
    const text = "First sentence. Second sentence.";
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 1,
      breakpointThresholdType: "gradient",
    });
    
    const chunks = await splitter.splitText(text);
    
    // With gradient and only 2 sentences, should return as is
    expect(chunks).toEqual([text]);
  });

  test("Test different threshold types", async () => {
    const text = "Dogs are pets. Cats are pets. Cars are vehicles. Bikes are vehicles. Food is good. Water is good.";
    
    const embeddings = new MockEmbeddings();
    
    const thresholdTypes = ["percentile", "standard_deviation", "interquartile", "gradient"] as const;
    
    for (const thresholdType of thresholdTypes) {
      const splitter = new SemanticChunker({
        embeddings,
        bufferSize: 0,
        breakpointThresholdType: thresholdType,
        breakpointThresholdAmount: thresholdType === "standard_deviation" ? 0.5 : 50,
      });
      
      const chunks = await splitter.splitText(text);
      
      // Should produce some chunks
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join(" ")).toEqual(text);
    }
  });

  test("Test with custom sentence split regex", async () => {
    const text = "First sentence! Second sentence? Third sentence. Fourth sentence!";
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 1,
      sentenceSplitRegex: "(?<=[!?])\\s+", // Split only on ! and ?
    });
    
    const chunks = await splitter.splitText(text);
    
    // Should have at least 2 chunks since it won't split on periods
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  test("Test with minimum chunk size", async () => {
    const text = "A. B. C. This is a longer sentence. D. E. F.";
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 0,
      breakpointThresholdType: "percentile",
      breakpointThresholdAmount: 10, // Low threshold to create many potential splits
      minChunkSize: 20, // Filter out small chunks
    });
    
    const chunks = await splitter.splitText(text);
    
    // All chunks should be at least minChunkSize
    chunks.forEach(chunk => {
      expect(chunk.length).toBeGreaterThanOrEqual(20);
    });
  });

  test("Test with number of chunks specified", async () => {
    const text = "One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.";
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 0,
      numberOfChunks: 3,
    });
    
    const chunks = await splitter.splitText(text);
    
    // Should attempt to create approximately 3 chunks
    expect(chunks.length).toBeLessThanOrEqual(5); // Some flexibility due to algorithm
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  test("Test createDocuments method", async () => {
    const texts = ["First document. Has two sentences.", "Second document. Also has two sentences."];
    const metadatas = [{ source: "doc1" }, { source: "doc2" }];
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 1,
      addStartIndex: true,
    });
    
    const documents = await splitter.createDocuments(texts, metadatas);
    
    // Should have documents
    expect(documents.length).toBeGreaterThan(0);
    
    // Each document should have metadata
    documents.forEach((doc) => {
      expect(doc.metadata).toBeDefined();
      expect(doc.metadata.source).toBeDefined();
      expect(doc.metadata.start_index).toBeDefined();
      expect(doc.pageContent).toBeTruthy();
    });
  });

  test("Test splitDocuments method", async () => {
    const documents = [
      new Document({
        pageContent: "First document content.",
        metadata: { id: 1 },
      }),
      new Document({
        pageContent: "Second document content.",
        metadata: { id: 2 },
      }),
    ];
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 1,
    });
    
    const splitDocs = await splitter.splitDocuments(documents);
    
    // Should preserve metadata
    splitDocs.forEach(doc => {
      expect(doc.metadata.id).toBeDefined();
      expect([1, 2]).toContain(doc.metadata.id);
    });
  });

  test("Test buffer size effect", async () => {
    const text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.";
    
    const embeddings = new MockEmbeddings();
    
    // Test with different buffer sizes
    for (const bufferSize of [0, 1, 2]) {
      const splitter = new SemanticChunker({
        embeddings,
        bufferSize,
        breakpointThresholdType: "percentile",
        breakpointThresholdAmount: 50,
      });
      
      const chunks = await splitter.splitText(text);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join(" ")).toEqual(text);
    }
  });
});

describe("Helper functions", () => {
  test("combineSentences with different buffer sizes", () => {
    const sentences = [
      { sentence: "First", index: 0 },
      { sentence: "Second", index: 1 },
      { sentence: "Third", index: 2 },
    ];
    
    // Buffer size 0
    const combined0 = combineSentences(sentences, 0);
    expect(combined0[0].combinedSentence).toEqual("First");
    expect(combined0[1].combinedSentence).toEqual("Second");
    expect(combined0[2].combinedSentence).toEqual("Third");
    
    // Buffer size 1
    const combined1 = combineSentences(sentences, 1);
    expect(combined1[0].combinedSentence).toEqual("First Second");
    expect(combined1[1].combinedSentence).toEqual("First Second Third");
    expect(combined1[2].combinedSentence).toEqual("Second Third");
  });

  test("calculateCosineDistances", () => {
    const sentences = [
      {
        sentence: "First",
        index: 0,
        combinedSentence: "First",
        combinedSentenceEmbedding: [1, 0, 0],
      },
      {
        sentence: "Second",
        index: 1,
        combinedSentence: "Second",
        combinedSentenceEmbedding: [0, 1, 0],
      },
      {
        sentence: "Third",
        index: 2,
        combinedSentence: "Third",
        combinedSentenceEmbedding: [0, 0, 1],
      },
    ];
    
    const [distances, returnedSentences] = calculateCosineDistances(sentences);
    
    // Orthogonal vectors should have distance of 1 (cosine similarity of 0)
    expect(distances).toHaveLength(2);
    expect(distances[0]).toBeCloseTo(1, 5);
    expect(distances[1]).toBeCloseTo(1, 5);
    expect(returnedSentences).toEqual(sentences);
  });

  test("calculateCosineDistances with similar embeddings", () => {
    const sentences = [
      {
        sentence: "First",
        index: 0,
        combinedSentence: "First",
        combinedSentenceEmbedding: [1, 0.5],
      },
      {
        sentence: "Second",
        index: 1,
        combinedSentence: "Second",
        combinedSentenceEmbedding: [0.9, 0.6],
      },
    ];
    
    const [distances] = calculateCosineDistances(sentences);
    
    // Similar vectors should have small distance
    expect(distances).toHaveLength(1);
    expect(distances[0]).toBeLessThan(0.5);
  });
});

describe("Edge cases", () => {
  test("Empty text", async () => {
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({ embeddings });
    
    const chunks = await splitter.splitText("");
    expect(chunks).toEqual([]);
  });

  test("Text with only whitespace", async () => {
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({ embeddings });
    
    const chunks = await splitter.splitText("   \n\n   ");
    expect(chunks).toEqual([]);
  });

  test("Very long sentences", async () => {
    const longSentence = "This is a very " + "long ".repeat(100) + "sentence.";
    const text = `${longSentence} Short sentence.`;
    
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      bufferSize: 0,
      breakpointThresholdType: "percentile",
      breakpointThresholdAmount: 50,
    });
    
    const chunks = await splitter.splitText(text);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join(" ")).toEqual(text);
  });

  test("Invalid threshold type handling", async () => {
    const embeddings = new MockEmbeddings();
    const splitter = new SemanticChunker({
      embeddings,
      // @ts-expect-error Testing invalid type
      breakpointThresholdType: "invalid",
    });
    
    const text = "First sentence. Second sentence. Third sentence.";
    
    await expect(splitter.splitText(text)).rejects.toThrow("Got unexpected breakpointThresholdType");
  });
});