/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare Worker that tests @langchain/core v1 exports
 * This worker runs WITHOUT nodejs_compat to verify the dynamic import pattern works
 */

// Import only from @langchain/core - no langchain package (which pulls in langgraph)
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { Document } from "@langchain/core/documents";
import { InMemoryStore } from "@langchain/core/stores";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate, ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

export interface Env {
  // No API keys needed for unit tests
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Message types
  try {
    const humanMsg = new HumanMessage("Hello");
    const aiMsg = new AIMessage("Hi there!");
    const systemMsg = new SystemMessage("You are helpful");
    const toolMsg = new ToolMessage({
      content: "result",
      tool_call_id: "123",
    });

    const isValid =
      humanMsg.content === "Hello" &&
      aiMsg.content === "Hi there!" &&
      systemMsg.content === "You are helpful" &&
      toolMsg.content === "result";

    results.push({
      name: "Message types",
      passed: isValid,
      error: isValid ? undefined : "Message content mismatch",
    });
  } catch (e) {
    results.push({
      name: "Message types",
      passed: false,
      error: String(e),
    });
  }

  // Test 2: Tool creation with zod schema
  try {
    const addTool = tool(
      async ({ a, b }: { a: number; b: number }) => {
        return String(a + b);
      },
      {
        name: "add",
        description: "Add two numbers",
        schema: z.object({
          a: z.number(),
          b: z.number(),
        }),
      }
    );

    const result = await addTool.invoke({ a: 2, b: 3 });
    results.push({
      name: "Tool creation",
      passed: result === "5",
      error: result === "5" ? undefined : `Expected "5", got "${result}"`,
    });
  } catch (e) {
    results.push({
      name: "Tool creation",
      passed: false,
      error: String(e),
    });
  }

  // Test 3: Document and InMemoryStore
  try {
    const doc = new Document({
      pageContent: "Test content",
      metadata: { source: "test" },
    });

    const store = new InMemoryStore<string>();
    await store.mset([["key1", "value1"]]);
    const values = await store.mget(["key1"]);

    const isValid =
      doc.pageContent === "Test content" && values[0] === "value1";

    results.push({
      name: "Document and Store",
      passed: isValid,
      error: isValid ? undefined : "Document or store mismatch",
    });
  } catch (e) {
    results.push({
      name: "Document and Store",
      passed: false,
      error: String(e),
    });
  }

  // Test 4: Runnable composition
  try {
    const addOne = RunnableLambda.from((x: number) => x + 1);
    const double = RunnableLambda.from((x: number) => x * 2);
    const chain = RunnableSequence.from([addOne, double]);

    const result = await chain.invoke(5);
    results.push({
      name: "Runnable composition",
      passed: result === 12,
      error: result === 12 ? undefined : `Expected 12, got ${result}`,
    });
  } catch (e) {
    results.push({
      name: "Runnable composition",
      passed: false,
      error: String(e),
    });
  }

  // Test 5: Prompt templates
  try {
    const template = PromptTemplate.fromTemplate("Hello {name}!");
    const result = await template.format({ name: "World" });

    const chatTemplate = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant"],
      ["human", "{input}"],
    ]);
    const chatResult = await chatTemplate.format({ input: "Hi" });

    const isValid =
      result === "Hello World!" && chatResult.includes("helpful assistant");

    results.push({
      name: "Prompt templates",
      passed: isValid,
      error: isValid ? undefined : "Prompt template mismatch",
    });
  } catch (e) {
    results.push({
      name: "Prompt templates",
      passed: false,
      error: String(e),
    });
  }

  // Test 6: Output parser
  try {
    const parser = new StringOutputParser();
    const result = await parser.invoke(new AIMessage("Hello"));

    results.push({
      name: "Output parser",
      passed: result === "Hello",
      error:
        result === "Hello" ? undefined : `Expected "Hello", got "${result}"`,
    });
  } catch (e) {
    results.push({
      name: "Output parser",
      passed: false,
      error: String(e),
    });
  }

  return results;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/test") {
      const results = await runTests();
      const allPassed = results.every((r) => r.passed);

      return new Response(
        JSON.stringify(
          {
            success: allPassed,
            results,
            summary: `${results.filter((r) => r.passed).length}/${
              results.length
            } tests passed`,
          },
          null,
          2
        ),
        {
          status: allPassed ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname === "/test/messages") {
      try {
        const humanMsg = new HumanMessage("Hello");
        const aiMsg = new AIMessage("Hi there!");
        return new Response(
          JSON.stringify({
            success: true,
            human: humanMsg.content,
            ai: aiMsg.content,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("Error handling /test/messages request", e);
        return new Response(
          JSON.stringify({ success: false, error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (url.pathname === "/test/tools") {
      try {
        const addTool = tool(
          async ({ a, b }: { a: number; b: number }) => String(a + b),
          {
            name: "add",
            description: "Add two numbers",
            schema: z.object({ a: z.number(), b: z.number() }),
          }
        );
        const result = await addTool.invoke({ a: 2, b: 3 });
        return new Response(JSON.stringify({ success: true, result }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Error handling /test/tools request", e);
        return new Response(
          JSON.stringify({ success: false, error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (url.pathname === "/test/runnables") {
      try {
        const addOne = RunnableLambda.from((x: number) => x + 1);
        const double = RunnableLambda.from((x: number) => x * 2);
        const chain = RunnableSequence.from([addOne, double]);
        const result = await chain.invoke(5);
        return new Response(JSON.stringify({ success: true, result }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Error handling /test/runnables request", e);
        return new Response(
          JSON.stringify({ success: false, error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "@langchain/core v1 Cloudflare Worker (no nodejs_compat)",
        endpoints: [
          "/test",
          "/test/messages",
          "/test/tools",
          "/test/runnables",
        ],
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
