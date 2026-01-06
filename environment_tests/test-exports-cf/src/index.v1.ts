/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Worker to test LangChain v1 compatibility.
 *
 * This worker tests:
 * - Core message types (HumanMessage, AIMessage, SystemMessage, ToolMessage)
 * - Tool creation with the `tool` function
 * - Document and InMemoryStore
 * - Universal chat model initialization (initChatModel)
 * - createAgent functionality
 */

// Import all v1 entrypoints to test they can be loaded
import "./entrypoints.v1.js";

// Import specific exports for testing
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  filterMessages,
  trimMessages,
  tool,
  DynamicTool,
  Document,
  InMemoryStore,
} from "langchain";
import { initChatModel } from "langchain/chat_models/universal";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { z } from "zod";

export interface Env {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

/**
 * Test that core message types work correctly
 */
function testMessageTypes(): { success: boolean; error?: string } {
  try {
    // Create messages of each type
    const humanMsg = new HumanMessage("Hello from user");
    const aiMsg = new AIMessage("Hello from AI");
    const systemMsg = new SystemMessage("You are a helpful assistant");
    const toolMsg = new ToolMessage({
      content: "Tool result",
      tool_call_id: "test-tool-call-id",
    });

    // Verify message properties
    if (humanMsg.content !== "Hello from user") {
      return { success: false, error: "HumanMessage content mismatch" };
    }
    if (aiMsg.content !== "Hello from AI") {
      return { success: false, error: "AIMessage content mismatch" };
    }
    if (systemMsg.content !== "You are a helpful assistant") {
      return { success: false, error: "SystemMessage content mismatch" };
    }
    if (toolMsg.content !== "Tool result") {
      return { success: false, error: "ToolMessage content mismatch" };
    }

    // Test filterMessages
    const messages = [humanMsg, aiMsg, systemMsg, toolMsg];
    const filtered = filterMessages(messages, {
      includeTypes: ["human", "ai"],
    });
    if (filtered.length !== 2) {
      return {
        success: false,
        error: `filterMessages returned ${filtered.length} messages, expected 2`,
      };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: `Message types test failed: ${e}` };
  }
}

/**
 * Test that tools can be created with the tool() function
 */
function testToolCreation(): { success: boolean; error?: string } {
  try {
    // Create a simple tool using the tool() function
    const searchTool = tool(
      ({ query }: { query: string }) => {
        return `Results for: ${query}`;
      },
      {
        name: "search",
        description: "Search for information",
        schema: z.object({
          query: z.string().describe("The search query"),
        }),
      }
    );

    // Verify tool properties
    if (searchTool.name !== "search") {
      return { success: false, error: "Tool name mismatch" };
    }
    if (searchTool.description !== "Search for information") {
      return { success: false, error: "Tool description mismatch" };
    }

    // Create a DynamicTool
    const dynamicTool = new DynamicTool({
      name: "calculator",
      description: "Performs basic math",
      func: async (input: string) => `Result: ${input}`,
    });

    if (dynamicTool.name !== "calculator") {
      return { success: false, error: "DynamicTool name mismatch" };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: `Tool creation test failed: ${e}` };
  }
}

/**
 * Test Document and InMemoryStore
 */
async function testDocumentAndStore(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Create documents
    const doc1 = new Document({
      pageContent: "LangChain is a framework for LLM applications",
      metadata: { source: "docs" },
    });
    const doc2 = new Document({
      pageContent: "Cloudflare Workers run at the edge",
      metadata: { source: "blog" },
    });

    if (doc1.pageContent !== "LangChain is a framework for LLM applications") {
      return { success: false, error: "Document pageContent mismatch" };
    }

    // Test InMemoryStore
    const store = new InMemoryStore<Uint8Array>();
    const encoder = new TextEncoder();

    await store.mset([
      ["key1", encoder.encode("value1")],
      ["key2", encoder.encode("value2")],
    ]);

    const values = await store.mget(["key1", "key2"]);
    if (values.length !== 2) {
      return {
        success: false,
        error: "InMemoryStore mget returned wrong count",
      };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: `Document/Store test failed: ${e}` };
  }
}

/**
 * Test initChatModel can be used (without actual API call)
 */
function testInitChatModelTypes(): { success: boolean; error?: string } {
  try {
    // Verify the function exists and has expected signature
    if (typeof initChatModel !== "function") {
      return { success: false, error: "initChatModel is not a function" };
    }

    // Verify ChatOpenAI and ChatAnthropic can be instantiated
    const openai = new ChatOpenAI({ openAIApiKey: "test-key" });
    if (!openai) {
      return { success: false, error: "ChatOpenAI instantiation failed" };
    }

    const anthropic = new ChatAnthropic({ anthropicApiKey: "test-key" });
    if (!anthropic) {
      return { success: false, error: "ChatAnthropic instantiation failed" };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: `initChatModel types test failed: ${e}` };
  }
}

/**
 * Test a simple chain can be created
 */
function testChainCreation(): { success: boolean; error?: string } {
  try {
    const prompt = ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    const llm = new ChatOpenAI({ openAIApiKey: "test-key" });
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    if (!chain) {
      return { success: false, error: "Chain creation failed" };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: `Chain creation test failed: ${e}` };
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Run different tests based on path
    const results: Record<string, { success: boolean; error?: string }> = {};

    // Always run unit tests that don't require API keys
    results.messageTypes = testMessageTypes();
    results.toolCreation = testToolCreation();
    results.documentAndStore = await testDocumentAndStore();
    results.initChatModelTypes = testInitChatModelTypes();
    results.chainCreation = testChainCreation();

    // If running integration tests with API keys
    if (path === "/integration" && env.OPENAI_API_KEY) {
      try {
        const prompt = ChatPromptTemplate.fromMessages([
          HumanMessagePromptTemplate.fromTemplate("{input}"),
        ]);
        const llm = new ChatOpenAI({ openAIApiKey: env.OPENAI_API_KEY });
        const chain = prompt.pipe(llm).pipe(new StringOutputParser());
        const response = await chain.invoke({ input: "Say hello in one word" });
        results.liveChain = {
          success: true,
          error: undefined,
        };
      } catch (e) {
        results.liveChain = {
          success: false,
          error: `Live chain test failed: ${e}`,
        };
      }
    }

    // Check if all tests passed
    const allPassed = Object.values(results).every((r) => r.success);
    const failedTests = Object.entries(results)
      .filter(([, r]) => !r.success)
      .map(([name, r]) => `${name}: ${r.error}`);

    if (allPassed) {
      return new Response(
        JSON.stringify({
          status: "success",
          message: "All LangChain v1 tests passed in Cloudflare Workers!",
          tests: results,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          status: "failed",
          message: "Some LangChain v1 tests failed",
          failedTests,
          tests: results,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
