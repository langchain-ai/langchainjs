import { describe, expect, it } from "vitest";
import { z } from "zod/v3";

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";

import { createAgent, toolStrategy, providerStrategy } from "../index.js";
import { FakeToolCallingModel, FakeToolCallingChatModel } from "./utils.js";
import {
  hasSupportForJsonSchemaOutput,
  ProviderStrategy,
} from "../responses.js";

describe("structured output handling", () => {
  describe("toolStrategy", () => {
    describe("multiple structured output tool calls", () => {
      it("should retry by default when multiple structured outputs are called", async () => {
        const model = new FakeToolCallingChatModel({
          responses: [
            new AIMessage({
              content: "",
              tool_calls: [
                { name: "extract-1", args: { foo: "foo" }, id: "call_1" },
                { name: "extract-2", args: { bar: "bar" }, id: "call_2" },
              ],
            }),
            new AIMessage({
              content: "",
              tool_calls: [
                {
                  name: "extract-1",
                  args: { foo: "valid structured value" },
                  id: "call_1",
                },
              ],
            }),
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy([
            z.object({
              foo: z.string(),
            }),
            z.object({
              bar: z.string(),
            }),
          ]),
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });

        expect(res.messages.length).toBeGreaterThan(1);
        expect(
          res.messages.some(
            (msg) =>
              typeof msg.content === "string" &&
              msg.content.includes("The model has called multiple tools")
          )
        ).toBe(true);
        expect(res.structuredResponse).toEqual({
          foo: "valid structured value",
        });
      });

      it("should throw if error handler is set to false", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              /**
               * `extract-3` and `extract-5` are the computed function names for the json schemas
               */
              { name: "extract-3", args: { foo: "foo" }, id: "call_1" },
              { name: "extract-4", args: { bar: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy(
            [
              z.object({
                foo: z.string(),
              }),
              z.object({
                bar: z.string(),
              }),
            ],
            {
              handleError: false,
            }
          ),
        });

        await expect(
          agent.invoke({
            messages: [{ role: "user", content: "hi" }],
          })
        ).rejects.toThrow("The model has called multiple tools");
      });

      it("should retry if error handler is set to true", async () => {
        const toolCalls = [
          { name: "extract-5", args: { foo: "foo" }, id: "call_1" },
          { name: "extract-6", args: { bar: "bar" }, id: "call_2" },
        ];
        const toolCall2 = [
          {
            name: "extract-5",
            args: { foo: "valid structured value" },
            id: "call_3",
          },
        ];
        const model = new FakeToolCallingChatModel({
          responses: [
            new AIMessage({
              content: "",
              tool_calls: toolCalls,
            }),
            new AIMessage({
              content: "",
              tool_calls: toolCall2,
            }),
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy(
            [
              z.object({
                foo: z.string(),
              }),
              z.object({
                bar: z.string(),
              }),
            ],
            {
              handleError: true,
            }
          ),
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi!" }],
        });

        expect(res.messages).toHaveLength(6);
        expect(res.messages[0].content).toContain("hi!");
        expect((res.messages[1] as AIMessage).tool_calls).toEqual(toolCalls);
        expect(res.messages[2].content).toContain(
          "The model has called multiple tools"
        );
        expect((res.messages[3] as AIMessage).tool_calls).toEqual(toolCall2);
        expect(res.messages[4].content).toContain(
          JSON.stringify({
            foo: "valid structured value",
          })
        );
        expect(res.messages[5].content).toContain(
          "Returning structured response"
        );
        expect(res.structuredResponse).toEqual({
          foo: "valid structured value",
        });
      });

      it("should retry if the error handler is set to the MultipleStructuredOutputsError", async () => {
        const toolCalls = [
          { name: "extract-7", args: { foo: "foo" }, id: "call_1" },
          { name: "extract-8", args: { bar: "bar" }, id: "call_2" },
        ];
        const toolCall2 = [
          {
            name: "extract-7",
            args: { foo: "fixed structured value" },
            id: "call_3",
          },
        ];
        const model = new FakeToolCallingChatModel({
          responses: [
            new AIMessage({
              content: "",
              tool_calls: [
                { name: "extract-7", args: { foo: "foo" }, id: "call_1" },
                { name: "extract-8", args: { bar: "bar" }, id: "call_2" },
              ],
            }),
            new AIMessage({
              content: "",
              tool_calls: [
                {
                  name: "extract-7",
                  args: { foo: "fixed structured value" },
                  id: "call_3",
                },
              ],
            }),
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy(
            [
              z.object({
                foo: z.string(),
              }),
              z.object({
                bar: z.string(),
              }),
            ],
            {
              handleError: () => "foobar",
            }
          ),
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi!" }],
        });

        expect(res.messages).toHaveLength(6);
        expect(res.messages[0].content).toContain("hi!");
        expect((res.messages[1] as AIMessage).tool_calls).toEqual(toolCalls);
        expect(res.messages[2].content).toContain("foobar");
        expect((res.messages[3] as AIMessage).tool_calls).toEqual(toolCall2);
        expect(res.messages[4].content).toContain(
          JSON.stringify({
            foo: "fixed structured value",
          })
        );
        expect(res.messages[5].content).toContain(
          "Returning structured response"
        );
        expect(res.structuredResponse).toEqual({
          foo: "fixed structured value",
        });
      });

      it("should throw if error handler throws an error", async () => {
        const model = new FakeToolCallingChatModel({
          responses: [
            new AIMessage({
              content: "",
              tool_calls: [
                { name: "extract-9", args: { foo: "foo" }, id: "call_1" },
                { name: "extract-10", args: { bar: "bar" }, id: "call_2" },
              ],
            }),
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy(
            [
              z.object({
                foo: z.string(),
              }),
              z.object({
                bar: z.string(),
              }),
            ],
            {
              handleError: () => {
                throw new Error("foobar");
              },
            }
          ),
        });

        await expect(
          agent.invoke({
            messages: [{ role: "user", content: "hi" }],
          })
        ).rejects.toThrow("foobar");
      });
    });

    describe("single structured output tool call", () => {
      it("should retry if error handler is set to true", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: "extract-11", args: { bar: "foo" }, id: "call_1" }],
            [
              {
                name: "extract-11",
                args: { foo: "fixed structured value" },
                id: "call_2",
              },
            ],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy(
            z.object({
              foo: z.string(),
            }),
            {
              handleError: true,
            }
          ),
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });
        expect(res.messages.length).toBe(6);
        expect(
          res.messages.some(
            (msg) =>
              typeof msg.content === "string" &&
              msg.content.includes("Failed to parse structured output")
          )
        ).toBe(true);
        expect(res.structuredResponse).toEqual({
          foo: "fixed structured value",
        });
      });

      it("should return a structured response if it matches the schema", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              { name: "something", args: { result: 123 }, id: "call_1" },
              { name: "extract-12", args: { foo: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy(
            z.object({
              foo: z.string(),
            })
          ),
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });

        expect(res.structuredResponse).toEqual({ foo: "bar" });
      });

      it("should return a structured response if it matches the schema and toolMessageContent is provided", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: "extract-13", args: { foo: "bar" }, id: "call_1" }],
          ],
        });

        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy(
            z.object({
              foo: z.string(),
            }),
            {
              toolMessageContent: "foobar",
            }
          ),
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });

        expect(res.structuredResponse).toEqual({ foo: "bar" });
        /**
         * We expect 3 messages:
         * 1. The user message
         * 2. The AI message calling the tool
         * 3. The tool message
         * 4. A structured response message (for compatibility with some models)
         */
        expect(res.messages.length).toBe(4);
        expect(res.messages.at(-1)?.content).toContain("foobar");
      });

      it("should return structured response if it matches one of the schemas", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: "extract-15", args: { bar: "foo" }, id: "call_1" }],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: toolStrategy([
            z.object({
              foo: z.string(),
            }),
            z.object({
              bar: z.string(),
            }),
          ]),
        });
        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });
        expect(res.structuredResponse).toEqual({ bar: "foo" });
      });
    });
  });

  describe("providerStrategy", () => {
    describe("use provider strategy directly", () => {
      it("should not throw error if use provider strategy directly", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: "extract-16", args: { foo: "bar" }, id: "call_2" }],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: providerStrategy(
            z.object({
              foo: z.string(),
            })
          ),
        });

        await expect(
          agent.invoke({
            messages: [{ role: "user", content: "hi" }],
          })
        ).resolves.not.toThrowError();
      });
    });

    describe("strict flag", () => {
      it("should default to false when strict is not provided", () => {
        const strategy = ProviderStrategy.fromSchema(
          z.object({
            foo: z.string(),
          })
        );
        expect(strategy.strict).toBe(false);
      });

      it("should set strict to true when explicitly provided", () => {
        const strategy = ProviderStrategy.fromSchema(
          z.object({
            foo: z.string(),
          }),
          true
        );
        expect(strategy.strict).toBe(true);
      });

      it("should set strict to false when explicitly provided as false", () => {
        const strategy = ProviderStrategy.fromSchema(
          z.object({
            foo: z.string(),
          }),
          false
        );
        expect(strategy.strict).toBe(false);
      });

      it("should work with providerStrategy helper function", () => {
        const strategyDefault = providerStrategy(
          z.object({
            foo: z.string(),
          })
        );
        expect(strategyDefault.strict).toBe(false);

        const strategyStrict = providerStrategy({
          schema: z.object({
            foo: z.string(),
          }),
          strict: true,
        });
        expect(strategyStrict.strict).toBe(true);
      });
    });
  });
});

describe("hasSupportForJsonSchemaOutput", () => {
  it("should return false for undefined model", () => {
    expect(hasSupportForJsonSchemaOutput(undefined)).toBe(false);
  });

  it("should return true for models that support JSON schema output", () => {
    const model = new FakeToolCallingModel({});
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
    const model2 = new FakeToolCallingChatModel({});
    expect(hasSupportForJsonSchemaOutput(model2)).toBe(true);
  });

  it("should return true for OpenAI models that support JSON schema output", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(true);
    expect(hasSupportForJsonSchemaOutput("openai:gpt-4o")).toBe(true);
    expect(hasSupportForJsonSchemaOutput("gpt-4o-mini")).toBe(true);
  });

  it("should return false for OpenAI models that do not support JSON schema output", () => {
    const model = new ChatOpenAI({
      model: "gpt-3.5-turbo",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
    expect(hasSupportForJsonSchemaOutput("openai:gpt-3.5-turbo")).toBe(false);
    expect(hasSupportForJsonSchemaOutput("gpt-3.5-turbo")).toBe(false);
  });

  it("should return false for Anthropic models that don't support JSON schema output", () => {
    const model = new ChatAnthropic({
      model: "claude-sonnet-4-5-20250929",
      anthropicApiKey: "foobar",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
    expect(
      hasSupportForJsonSchemaOutput("anthropic:claude-sonnet-4-5-20250929")
    ).toBe(false);
    expect(hasSupportForJsonSchemaOutput("claude-sonnet-4-5-20250929")).toBe(
      false
    );
  });
});
