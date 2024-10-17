/* eslint-disable no-process-env */
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { LLMResult } from "@langchain/core/outputs";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { ChatWatsonx } from "../ibm.js";

describe("Tests for chat", () => {
  describe("Test ChatWatsonx invoke and generate", () => {
    test("Basic invoke", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const res = await service.invoke("Print hello world");
      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Basic generate", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const message = new HumanMessage("Hello");
      const res = await service.generate([[message], [message]]);
      expect(res.generations.length).toBe(2);
    });
    test("Invoke with system message", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const messages = [
        new SystemMessage("Translate the following from English into Italian"),
        new HumanMessage("hi!"),
      ];
      const res = await service.invoke(messages);
      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Invoke with output parser", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const parser = new StringOutputParser();
      const messages = [
        new SystemMessage("Translate the following from English into Italian"),
        new HumanMessage("hi!"),
      ];
      const res = await service.invoke(messages);
      const parsed = await parser.invoke(res);
      expect(typeof parsed).toBe("string");
    });
    test("Invoke with prompt", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const systemTemplate = "Translate the following into {language}:";
      const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", systemTemplate],
        ["user", "{text}"],
      ]);
      const llmChain = promptTemplate.pipe(service);
      const res = await llmChain.invoke({ language: "italian", text: "hi" });
      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Invoke with chat conversation", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const res = await service.invoke([
        { role: "user", content: "Hi! I'm Bob" },
        {
          role: "assistant",
          content: "Hello Bob! How can I assist you today?",
        },
        { role: "user", content: "What's my name?" },
      ]);
      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Token usage", async () => {
      let tokenUsage = {
        completion_tokens: 0,
        prompt_tokens: 0,
        totalTokens: 0,
      };
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        callbackManager: CallbackManager.fromHandlers({
          async handleLLMEnd(output: LLMResult) {
            tokenUsage = output.llmOutput?.tokenUsage;
          },
        }),
      });

      const message = new HumanMessage("Hello");
      await service.invoke([message]);
      expect(tokenUsage.prompt_tokens).toBeGreaterThan(0);
    });
    test("Timeout", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      await expect(() =>
        service.invoke("Print hello world", {
          timeout: 10,
        })
      ).rejects.toThrow();
    }, 5000);
    test("Controller options", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const controller = new AbortController();
      await expect(() => {
        const res = service.invoke("Print hello world", {
          signal: controller.signal,
        });
        controller.abort();
        return res;
      }).rejects.toThrow();
    }, 5000);
  });

  describe("Test ChatWatsonx invoke and generate with stream mode", () => {
    test("Basic invoke", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const res = await service.invoke("Print hello world");

      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Basic generate", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const message = new HumanMessage("Hello");
      const res = await service.generate([[message], [message]]);
      expect(res.generations.length).toBe(2);
    });
    test("Generate with n>1", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        n: 3,
      });
      const message = new HumanMessage("Print hello world");
      const res = await service.generate([[message]]);
      for (const generation of res.generations) {
        expect(generation.length).toBe(3);
        for (const gen of generation) {
          expect(typeof gen.text).toBe("string");
        }
      }
    });
    test("Generate with n>1 token count", async () => {
      process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

      let tokenUsage = {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      const generationsStreamed = [
        ["", ""],
        ["", ""],
      ];
      let tokenUsed = 0;
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        n: 2,
        max_new_tokens: 5,
        streaming: true,
        callbackManager: CallbackManager.fromHandlers({
          async handleLLMEnd(output: LLMResult) {
            const usage = output.llmOutput?.tokenUsage;
            tokenUsage = {
              input_tokens: usage.input_tokens + tokenUsage.input_tokens,
              output_tokens: usage.output_tokens + tokenUsage.output_tokens,
              total_tokens: usage.total_tokens + tokenUsage.total_tokens,
            };
          },
          async handleLLMNewToken(token: string, idx: NewTokenIndices) {
            const { prompt, completion } = idx;
            generationsStreamed[prompt][completion] += token;
            tokenUsed += 1;
          },
        }),
      });
      const message = new HumanMessage("Print hello world");
      const res = await service.generate([[message], [message]]);
      for (const generation of res.generations) {
        expect(generation.length).toBe(2);
        for (const gen of generation) {
          expect(typeof gen.text).toBe("string");
        }
      }
      expect(tokenUsed).toBe(tokenUsage.output_tokens);
      expect(res.generations.map((g) => g.map((gg) => gg.text))).toEqual(
        generationsStreamed
      );
    });
    test("Invoke with system message", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const messages = [
        new SystemMessage("Translate the following from English into Italian"),
        new HumanMessage("hi!"),
      ];
      const res = await service.invoke(messages);
      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Invoke with output parser", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const parser = new StringOutputParser();
      const messages = [
        new SystemMessage("Translate the following from English into Italian"),
        new HumanMessage("hi!"),
      ];
      const res = await service.invoke(messages);
      const parsed = await parser.invoke(res);
      expect(typeof parsed).toBe("string");
    });
    test("Invoke with prompt", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const systemTemplate = "Translate the following into {language}:";
      const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", systemTemplate],
        ["user", "{text}"],
      ]);
      const llmChain = promptTemplate.pipe(service);
      const res = await llmChain.invoke({ language: "italian", text: "hi" });
      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Invoke with chat conversation", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const res = await service.invoke([
        { role: "user", content: "Hi! I'm Bob" },
        {
          role: "assistant",
          content: "Hello Bob! How can I assist you today?",
        },
        { role: "user", content: "What's my name?" },
      ]);
      expect(res).toBeInstanceOf(AIMessage);
    });
    test("Token usage", async () => {
      let tokenUsage = {
        completion_tokens: 0,
        prompt_tokens: 0,
        totalTokens: 0,
      };
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        callbackManager: CallbackManager.fromHandlers({
          async handleLLMEnd(output: LLMResult) {
            tokenUsage = output.llmOutput?.tokenUsage;
          },
        }),
      });

      const message = new HumanMessage("Hello");
      await service.invoke([message]);
      expect(tokenUsage.prompt_tokens).toBeGreaterThan(0);
    });
    test("Timeout", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      await expect(() =>
        service.invoke("Print hello world", {
          timeout: 10,
        })
      ).rejects.toThrow();
    }, 5000);
    test("Controller options", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const controller = new AbortController();
      await expect(() => {
        const res = service.invoke("Print hello world", {
          signal: controller.signal,
        });
        controller.abort();
        return res;
      }).rejects.toThrow();
    }, 5000);
  });

  describe("Test ChatWatsonx stream", () => {
    test("Basic stream", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful assistant"],
        ["human", "{input}"],
      ]);
      const res = await prompt.pipe(service).stream({
        input: "Print hello world.",
      });
      const chunks = [];
      for await (const chunk of res) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("").length).toBeGreaterThan(1);
    });
    test("Timeout", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      await expect(() =>
        service.stream("Print hello world", {
          timeout: 10,
        })
      ).rejects.toThrow();
    }, 5000);
    test("Controller options", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const controller = new AbortController();
      await expect(async () => {
        const res = await service.stream("Print hello world", {
          signal: controller.signal,
        });
        let hasEntered = false;
        for await (const chunk of res) {
          hasEntered = true;
          expect(chunk).toBeDefined();
          controller.abort();
        }
        expect(hasEntered).toBe(true);
      }).rejects.toThrow();
    }, 5000);
    test("Token count and response equality", async () => {
      let tokenUsage = {
        completionTokens: 0,
        promptTokens: 0,
        totalTokens: 0,
      };
      let generation = "";
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        callbackManager: CallbackManager.fromHandlers({
          async handleLLMEnd(output: LLMResult) {
            tokenUsage = output.llmOutput?.tokenUsage;
            generation = output.generations[0][0].text;
          },
        }),
      });
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful assistant"],
        ["human", "{input}"],
      ]);
      const res = await prompt.pipe(service).stream({
        input: "Print hello world",
      });
      let tokenCount = 0;
      const chunks = [];
      for await (const chunk of res) {
        tokenCount += 1;
        chunks.push(chunk.content);
      }
      expect(tokenCount).toBe(tokenUsage.completionTokens);
      expect(chunks.join("")).toBe(generation);
    });
    test("Token count usage_metadata", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      let res: AIMessageChunk | null = null;
      const stream = await service.stream("Why is the sky blue? Be concise.");
      for await (const chunk of stream) {
        res = chunk;
      }
      expect(res?.usage_metadata).toBeDefined();
      if (!res?.usage_metadata) {
        return;
      }
      expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
      expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
      expect(res.usage_metadata.total_tokens).toBe(
        res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
      );
    });
  });

  describe("Test tool usage", () => {
    test("Passing tool to chat model", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const calculatorSchema = z.object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      });

      const calculatorTool = tool(
        async ({
          operation,
          number1,
          number2,
        }: {
          operation: string;
          number1: number;
          number2: number;
        }) => {
          // Functions must return strings
          if (operation === "add") {
            return `${number1 + number2}`;
          } else if (operation === "subtract") {
            return `${number1 - number2}`;
          } else if (operation === "multiply") {
            return `${number1 * number2}`;
          } else if (operation === "divide") {
            return `${number1 / number2}`;
          } else {
            throw new Error("Invalid operation.");
          }
        },
        {
          name: "calculator",
          description: "Can perform mathematical operations.",
          schema: calculatorSchema,
        }
      );
      const llmWithTools = service.bindTools([calculatorTool]);
      const res = await llmWithTools.invoke("What is 3 * 12");

      expect(res).toBeInstanceOf(AIMessage);
      expect(res.tool_calls?.[0].name).toBe("calculator");
      expect(typeof res.tool_calls?.[0].args?.operation).toBe("string");
      expect(typeof res.tool_calls?.[0].args?.number1).toBe("number");
      expect(typeof res.tool_calls?.[0].args?.number2).toBe("number");
      expect(res.response_metadata.finish_reason).toBe("tool_calls");
    });
    test("Passing tool to chat model extended", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const calculatorSchema = z.object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      });

      const calculatorTool = tool(
        async ({
          operation,
          number1,
          number2,
        }: {
          operation: string;
          number1: number;
          number2: number;
        }) => {
          // Functions must return strings
          if (operation === "add") {
            return `${number1 + number2}`;
          } else if (operation === "subtract") {
            return `${number1 - number2}`;
          } else if (operation === "multiply") {
            return `${number1 * number2}`;
          } else if (operation === "divide") {
            return `${number1 / number2}`;
          } else {
            throw new Error("Invalid operation.");
          }
        },
        {
          name: "calculator",
          description: "Can perform mathematical operations.",
          schema: calculatorSchema,
        }
      );
      const llmWithTools = service.bindTools([calculatorTool]);
      const res = await llmWithTools.invoke(
        "What is 3 * 12? Also, what is 11 + 49?"
      );

      expect(res).toBeInstanceOf(AIMessage);
      expect(res.tool_calls).toBeDefined();
      if (!res.tool_calls) return;
      expect(res.tool_calls.length).toBe(2);

      for (const tool_call of res.tool_calls) {
        expect(tool_call.name).toBe("calculator");
        expect(typeof tool_call.args?.operation).toBe("string");
        expect(typeof tool_call.args?.number1).toBe("number");
        expect(typeof tool_call.args?.number2).toBe("number");
      }
    });
    test("Binding model-specific formats", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });

      const modelWithTools = service.bind({
        tools: [
          {
            type: "function",
            function: {
              name: "calculator",
              description: "Can perform mathematical operations.",
              parameters: {
                type: "object",
                properties: {
                  operation: {
                    type: "string",
                    description: "The type of operation to execute.",
                    enum: ["add", "subtract", "multiply", "divide"],
                  },
                  number1: { type: "number", description: "First integer" },
                  number2: { type: "number", description: "Second integer" },
                },
                required: ["number1", "number2"],
              },
            },
          },
        ],
      });
      const res = await modelWithTools.invoke("What is 32 * 122");

      expect(res).toBeInstanceOf(AIMessage);
      expect(res.tool_calls?.[0].name).toBe("calculator");
      expect(typeof res.tool_calls?.[0].args?.operation).toBe("string");
      expect(typeof res.tool_calls?.[0].args?.number1).toBe("number");
      expect(typeof res.tool_calls?.[0].args?.number2).toBe("number");
      expect(res.response_metadata.finish_reason).toBe("tool_calls");
    });
    test("Passing tool to chat model", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const addTool = tool(
        async (input) => {
          return input.a + input.b;
        },
        {
          name: "add",
          description: "Adds a and b.",
          schema: z.object({
            a: z.number(),
            b: z.number(),
          }),
        }
      );

      const multiplyTool = tool(
        async (input) => {
          return input.a * input.b;
        },
        {
          name: "multiply",
          description: "Multiplies a and b.",
          schema: z.object({
            a: z.number(),
            b: z.number(),
          }),
        }
      );
      const tools = [addTool, multiplyTool];

      const modelWithTools = service.bindTools(tools);
      const res = await modelWithTools.invoke(
        "What is 3 * 12? Also, what is 11 + 49?"
      );

      expect(res).toBeInstanceOf(AIMessage);
      expect(res.tool_calls).toBeDefined();
      if (!res.tool_calls) return;
      expect(res.tool_calls.length).toBe(2);

      expect(res.tool_calls[0].name).not.toBe(res.tool_calls[1].name);
      expect(res.tool_calls[0].args.a).not.toBe(res.tool_calls[1].args.a);
      expect(res.tool_calls[0].args.b).not.toBe(res.tool_calls[1].args.b);
    });
  });

  describe("Test withStructuredOutput usage", () => {
    test("Schema with zod", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const joke = z.object({
        setup: z.string().describe("The setup of the joke"),
        punchline: z.string().describe("The punchline to the joke"),
        rating: z
          .number()
          .optional()
          .describe("How funny the joke is, from 1 to 10"),
      });

      const structuredLlm = service.withStructuredOutput(joke);

      const res = await structuredLlm.invoke("Tell me a joke about cats");
      expect("setup" in res).toBe(true);
      expect("punchline" in res).toBe(true);
    });

    test("Schema with zod and stream", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        temperature: 0.2,
      });
      const joke = z.object({
        setup: z.string().describe("The setup of the joke"),
        punchline: z.string().describe("The punchline to the joke"),
        rating: z
          .number()
          .optional()
          .describe("How funny the joke is, from 1 to 10"),
      });

      const structuredLlm = service.withStructuredOutput(joke);
      const res = await structuredLlm.stream("Tell me a joke about cats");
      let object = {};
      for await (const chunk of res) {
        expect(typeof chunk).toBe("object");
        object = chunk;
      }
      expect("setup" in object).toBe(true);
      expect("punchline" in object).toBe(true);
    });
    test("Schema with object", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        temperature: 0.2,
      });
      const structuredLlm = service.withStructuredOutput({
        name: "joke",
        description: "Joke to tell user.",
        parameters: {
          title: "Joke",
          type: "object",
          properties: {
            setup: { type: "string", description: "The setup for the joke" },
            punchline: { type: "string", description: "The joke's punchline" },
          },
          required: ["setup", "punchline"],
        },
      });

      const res = await structuredLlm.invoke("Tell me a joke about cats");
      expect(res).toBeDefined();
      expect(typeof res.setup).toBe("string");
      expect(typeof res.punchline).toBe("string");
    });
    test("Schema with rawOutput", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        temperature: 0.2,
      });
      const structuredLlm = service.withStructuredOutput(
        {
          name: "joke",
          description: "Joke to tell user.",
          parameters: {
            title: "Joke",
            type: "object",
            properties: {
              setup: { type: "string", description: "The setup for the joke" },
              punchline: {
                type: "string",
                description: "The joke's punchline",
              },
            },
            required: ["setup", "punchline"],
          },
        },
        { includeRaw: true }
      );

      const res = await structuredLlm.invoke("Tell me a joke about cats");
      expect(res.raw).toBeInstanceOf(AIMessage);
      expect(typeof res.parsed.setup).toBe("string");
      expect(typeof res.parsed.setup).toBe("string");
    });
    test("Schema with zod and JSON mode", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        temperature: 0,
      });
      const calculatorSchema = z.object({
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        number1: z.number(),
        number2: z.number(),
      });
      const modelWithStructuredOutput = service.withStructuredOutput(
        calculatorSchema,
        {
          name: "calculator",
          method: "jsonMode",
        }
      );
      const prompt = ChatPromptTemplate.fromMessages([
        {
          role: "system",
          content: `Reply structure should be type of JSON as followed:
    'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
    'number1': the first number to operate on,
    'number2': the second number to operate on.
    `,
        },
        { role: "human", content: "What is 21 * 12?" },
      ]);
      const modelWithStructuredOutoputJson = prompt.pipe(
        modelWithStructuredOutput
      );
      const result = await modelWithStructuredOutoputJson.invoke("");
      expect(typeof result.operation).toBe("string");
      expect(typeof result.number1).toBe("number");
      expect(typeof result.number2).toBe("number");
    });
  });

  describe("Test image input", () => {
    test("Image input", async () => {
      const service = new ChatWatsonx({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        modelId: "meta-llama/llama-3-2-11b-vision-instruct",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        max_new_tokens: 100,
      });
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const encodedString = await fs.readFile(
        path.join(__dirname, "/data/hotdog.jpg")
      );
      const question = "What is on the picture";
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: question,
            },
            {
              type: "image_url",
              image_url: {
                url:
                  "data:image/jpeg;base64," + encodedString.toString("base64"),
              },
            },
          ],
        },
      ];
      const res = await service.stream(messages);
      const chunks = [];
      for await (const chunk of res) {
        expect(chunk).toBeInstanceOf(AIMessageChunk);
        chunks.push(chunk.content);
      }
      expect(typeof chunks.join("")).toBe("string");
    });
  });
});
