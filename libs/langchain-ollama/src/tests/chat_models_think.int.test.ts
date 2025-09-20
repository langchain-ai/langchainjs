import { test, expect } from "@jest/globals";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatOllama } from "../chat_models.js";

test("test deep seek model with think=false", async () => {
  const ollama = new ChatOllama({
    model: "deepseek-r1:32b",
    think: false, // Ensure the "think" field is explicitly set to false
    maxRetries: 1,
  });

  const res = await ollama.invoke([
    new HumanMessage({
      content: "Explain the process of photosynthesis briefly.",
    }),
  ]);

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();

  const responseContent = res.content;

  // Validate that the response does not include any <think>...</think> blocks
  // s means allow . to match new line character
  expect(responseContent).not.toMatch(/<think>.*?<\/think>/is);

  // Ensure the response is concise and directly answers the question
  expect(responseContent).toMatch(/photosynthesis/i); // Check it includes the topic
  expect(responseContent.length).toBeGreaterThan(1);
});

test("test deep seek model with think=true (default)", async () => {
  const ollama = new ChatOllama({
    model: "deepseek-r1:32b",
    maxRetries: 1,
  });

  const res = await ollama.invoke([
    new HumanMessage({
      content: "Explain the process of photosynthesis briefly.",
    }),
  ]);

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();

  const responseContent = res.content;

  // Ensure the response is concise and directly answers the question
  expect(responseContent).toMatch(/photosynthesis/i); // Check it includes the topic
  expect(responseContent.length).toBeGreaterThan(1);
});

test("test type safety for thinking parameter values", async () => {
  // Test that TypeScript accepts all valid string and boolean values
  const ollamaHigh = new ChatOllama({
    model: "deepseek-r1:32b",
    think: "high" as const,
    maxRetries: 1,
  });
  
  const ollamaMedium = new ChatOllama({
    model: "deepseek-r1:32b", 
    think: "medium" as const,
    maxRetries: 1,
  });
  
  const ollamaLow = new ChatOllama({
    model: "deepseek-r1:32b",
    think: "low" as const,
    maxRetries: 1,
  });
  
  const ollamaTrue = new ChatOllama({
    model: "deepseek-r1:32b",
    think: true,
    maxRetries: 1,
  });
  
  const ollamaFalse = new ChatOllama({
    model: "deepseek-r1:32b",
    think: false,
    maxRetries: 1,
  });

  // All should be properly instantiated
  expect(ollamaHigh).toBeDefined();
  expect(ollamaMedium).toBeDefined();
  expect(ollamaLow).toBeDefined();
  expect(ollamaTrue).toBeDefined();
  expect(ollamaFalse).toBeDefined();
  
  // Quick test that string values work in practice
  const res = await ollamaHigh.invoke([
    new HumanMessage({ content: "How many r in the word strawberry?" })
  ]);
  
  expect(res).toBeDefined();
  expect(typeof res.content).toBe("string");
  expect(res.content.length).toBeGreaterThan(0);
});

test.each([
  { thinkLevel: "high" as const },
  { thinkLevel: "medium" as const },
  { thinkLevel: "low" as const },
])("test string thinking parameter '$thinkLevel'", async ({ thinkLevel }) => {
  const ollama = new ChatOllama({
    model: "deepseek-r1:32b",
    think: thinkLevel,
    maxRetries: 1,
  });

  const res = await ollama.invoke([
    new HumanMessage({
      content: "How many r in the word strawberry?",
    }),
  ]);

  // Ensure the response is defined
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();
  expect(res.additional_kwargs).toBeDefined();

  // Validate basic functionality - response should exist and not contain thinking tags
  expect(typeof res.content).toBe("string");
  expect(res.content.length).toBeGreaterThan(0);
  expect(res.content).not.toMatch(/<think>.*?<\/think>/is); // No thinking tags in content

  // For string thinking levels, validate thinking content if present
  if (res.additional_kwargs?.thinking_content) {
    const thinkingContent = res.additional_kwargs.thinking_content as string;
    expect(typeof thinkingContent).toBe("string");
    expect(thinkingContent.length).toBeGreaterThan(0);
    // Thinking should not be duplicated/corrupted
    expect(thinkingContent).not.toMatch(/(.+)\1{3,}/); // No excessive repetition
  }
});

test("test content separation and deduplication", async () => {
  const ollama = new ChatOllama({
    model: "deepseek-r1:32b",
    think: "high",
    maxRetries: 1,
  });

  const res = await ollama.invoke([
    new HumanMessage({
      content: "How many r in the word strawberry?",
    }),
  ]);

  // Ensure proper content separation
  expect(res).toBeDefined();
  expect(res.content).toBeDefined();
  expect(res.additional_kwargs).toBeDefined();

  // Main content should exist
  expect(typeof res.content).toBe("string");
  expect(res.content.length).toBeGreaterThan(0);

  // Thinking content should be properly separated and clean if present
  if (res.additional_kwargs?.thinking_content) {
    const thinkingContent = res.additional_kwargs.thinking_content as string;
    expect(typeof thinkingContent).toBe("string");
    expect(thinkingContent.length).toBeGreaterThan(10); // Should have substantial thinking
    
    // Validate comprehensive deduplication - no repetitive patterns
    expect(thinkingContent).not.toMatch(/^(.+?)\1+$/); // Not entirely repeated content
    
    // Should be reasonable length
    expect(thinkingContent.length).toBeLessThan(5000);
    
    // Advanced duplication detection
    const words = thinkingContent.split(' ');
    const uniqueWords = new Set(words);
    const repetitionRatio = words.length / uniqueWords.size;
    expect(repetitionRatio).toBeLessThan(3); // Reasonable repetition threshold
  }
});

test("test streaming with thinking content separation", async () => {
  const ollama = new ChatOllama({
    model: "deepseek-r1:32b",
    think: "high",
    maxRetries: 1,
  });

  const chunks: AIMessageChunk[] = [];
  const stream = await ollama.stream([
    new HumanMessage({
      content: "How many r in the word strawberry?",
    }),
  ]);

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  expect(chunks.length).toBeGreaterThan(0);

  // Validate that streaming chunks maintain proper content separation
  let hasThinkingContent = false;
  let finalContent = "";

  for (const chunk of chunks) {
    if (chunk.content) {
      finalContent += chunk.content;
    }
    
    // Check if any chunk has thinking content in additional_kwargs
    if (chunk.additional_kwargs?.thinking_content) {
      hasThinkingContent = true;
      expect(typeof chunk.additional_kwargs.thinking_content).toBe("string");
    }
  }

  // Final content should exist and be non-empty
  expect(typeof finalContent).toBe("string");
  expect(finalContent.length).toBeGreaterThan(0);
  
  // At least one chunk should have had thinking content
  expect(hasThinkingContent).toBe(true);
});
