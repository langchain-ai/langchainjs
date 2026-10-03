import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool, type ClientTool } from "@langchain/core/tools";
import type { SerializableSchema } from "@langchain/core/utils/standard_schema";

import { fakeModel } from "@langchain/core/testing";

import {
  createAgent,
  createMiddleware,
  toolStrategy,
  providerStrategy,
} from "../index.js";
import { FakeToolCallingModel, FakeToolCallingChatModel } from "./utils.js";
import {
  hasSupportForJsonSchemaOutput,
  ProviderStrategy,
  ToolStrategy,
  type ResponseFormatInput,
} from "../responses.js";

/** The tool calls a `FakeToolCallingModel` replays, one entry per request. */
type FakeToolCalls = NonNullable<
  ConstructorParameters<typeof FakeToolCallingModel>[0]
>["toolCalls"];

function makeSerializableSchema(
  jsonSchema: Record<string, unknown> = {
    type: "object",
    properties: {
      foo: { type: "string" },
    },
    required: ["foo"],
  }
): SerializableSchema {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "test",
      validate: (value: unknown) => ({ value }),
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
    },
  } as unknown as SerializableSchema;
}

describe("structured output handling", () => {
  describe("toolStrategy", () => {
    describe("multiple structured output tool calls", () => {
      it("should retry by default when multiple structured outputs are called", async () => {
        const responseFormat = toolStrategy([
          z.object({
            foo: z.string(),
          }),
          z.object({
            bar: z.string(),
          }),
        ]);
        const [{ name: fooToolName }, { name: barToolName }] = responseFormat;
        const model = new FakeToolCallingChatModel({
          responses: [
            new AIMessage({
              content: "",
              tool_calls: [
                { name: fooToolName, args: { foo: "foo" }, id: "call_1" },
                { name: barToolName, args: { bar: "bar" }, id: "call_2" },
              ],
            }),
            new AIMessage({
              content: "",
              tool_calls: [
                {
                  name: fooToolName,
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
          responseFormat,
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
        const responseFormat = toolStrategy(
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
        );
        const [{ name: fooToolName }, { name: barToolName }] = responseFormat;
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              { name: fooToolName, args: { foo: "foo" }, id: "call_1" },
              { name: barToolName, args: { bar: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat,
        });

        await expect(
          agent.invoke({
            messages: [{ role: "user", content: "hi" }],
          })
        ).rejects.toThrow("The model has called multiple tools");
      });

      it("should retry if error handler is set to true", async () => {
        const responseFormat = toolStrategy(
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
        );
        const [{ name: fooToolName }, { name: barToolName }] = responseFormat;
        const toolCalls = [
          { name: fooToolName, args: { foo: "foo" }, id: "call_1" },
          { name: barToolName, args: { bar: "bar" }, id: "call_2" },
        ];
        const toolCall2 = [
          {
            name: fooToolName,
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
          responseFormat,
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
        const responseFormat = toolStrategy(
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
        );
        const [{ name: fooToolName }, { name: barToolName }] = responseFormat;
        const toolCalls = [
          { name: fooToolName, args: { foo: "foo" }, id: "call_1" },
          { name: barToolName, args: { bar: "bar" }, id: "call_2" },
        ];
        const toolCall2 = [
          {
            name: fooToolName,
            args: { foo: "fixed structured value" },
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
          responseFormat,
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
        const responseFormat = toolStrategy(
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
        );
        const [{ name: fooToolName }, { name: barToolName }] = responseFormat;
        const model = new FakeToolCallingChatModel({
          responses: [
            new AIMessage({
              content: "",
              tool_calls: [
                { name: fooToolName, args: { foo: "foo" }, id: "call_1" },
                { name: barToolName, args: { bar: "bar" }, id: "call_2" },
              ],
            }),
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat,
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
        const responseFormat = toolStrategy(
          z.object({
            foo: z.string(),
          }),
          {
            handleError: true,
          }
        );
        const [{ name: toolName }] = responseFormat;
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: toolName, args: { bar: "foo" }, id: "call_1" }],
            [
              {
                name: toolName,
                args: { foo: "fixed structured value" },
                id: "call_2",
              },
            ],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat,
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
        const responseFormat = toolStrategy(
          z.object({
            foo: z.string(),
          })
        );
        const [{ name: toolName }] = responseFormat;
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              { name: "something", args: { result: 123 }, id: "call_1" },
              { name: toolName, args: { foo: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat,
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });

        expect(res.structuredResponse).toEqual({ foo: "bar" });
      });

      it("should return a structured response if it matches the schema and toolMessageContent is provided", async () => {
        const responseFormat = toolStrategy(
          z.object({
            foo: z.string(),
          }),
          {
            toolMessageContent: "foobar",
          }
        );
        const [{ name: toolName }] = responseFormat;
        const model = new FakeToolCallingModel({
          toolCalls: [[{ name: toolName, args: { foo: "bar" }, id: "call_1" }]],
        });

        const agent = createAgent({
          model,
          tools: [],
          responseFormat,
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
        const responseFormat = toolStrategy([
          z.object({
            foo: z.string(),
          }),
          z.object({
            bar: z.string(),
          }),
        ]);
        const [, { name: barToolName }] = responseFormat;
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: barToolName, args: { bar: "foo" }, id: "call_1" }],
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat,
        });
        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });
        expect(res.structuredResponse).toEqual({ bar: "foo" });
      });
    });

    describe("schema title extraction", () => {
      it("should use title from Zod v4 schema with .meta({ title })", () => {
        const zodSchema = z4
          .object({
            status: z4.string(),
          })
          .meta({ title: "my_custom_tool" });

        const [strategy] = toolStrategy(zodSchema);

        expect(strategy.name).toBe("my_custom_tool");
      });

      it("should use title from JSON schema", () => {
        const jsonSchema = {
          type: "object" as const,
          title: "my_json_tool",
          properties: {
            status: { type: "string" },
          },
        };

        const [strategy] = toolStrategy(jsonSchema);

        expect(strategy.name).toBe("my_json_tool");
      });

      it("should fall back to a schema-derived name when no title is provided", () => {
        const zodSchema = z4.object({
          status: z4.string(),
        });

        const [strategy] = toolStrategy(zodSchema);

        expect(strategy.name).toMatch(/^extract-[0-9a-f]{16}$/);
      });

      it("should use title from ToolStrategy.fromSchema with Zod v4 schema", () => {
        const zodSchema = z4
          .object({
            result: z4.number(),
          })
          .meta({ title: "calculate_result" });

        const strategy = ToolStrategy.fromSchema(zodSchema);

        expect(strategy.name).toBe("calculate_result");
      });

      it("should use title from ToolStrategy.fromSchema with JSON schema", () => {
        const jsonSchema = {
          type: "object" as const,
          title: "get_data",
          properties: {
            value: { type: "number" },
          },
        };

        const strategy = ToolStrategy.fromSchema(jsonSchema);

        expect(strategy.name).toBe("get_data");
      });
    });

    describe("deterministic tool naming", () => {
      /**
       * Tools reach `bindTools` in two shapes: user tools as class instances
       * carrying `name`, structured output tools as OpenAI-style function
       * definitions carrying it under `function`.
       */
      function nameOfBoundTool(boundTool: unknown): string {
        const { name, function: fn } = boundTool as {
          name?: string;
          function?: { name?: string };
        };
        const boundName = name ?? fn?.name;
        if (boundName == null) {
          throw new Error(
            `Bound tool has no name: ${JSON.stringify(boundTool)}`
          );
        }
        return boundName;
      }

      /**
       * Runs an agent against a fake model, capturing the tool names it
       * offered the model on each model request.
       *
       * The generated name is not public API, so tests read it back from what
       * was actually bound rather than hardcoding it - except where pinning
       * the literal is the point.
       *
       * @returns the agent, `boundToolNames` (one entry per model request, and
       *   appended to by any further invocation), and the run's result
       */
      async function runAgent({
        responseFormat,
        tools = [],
        toolCalls = [],
      }: {
        responseFormat: ResponseFormatInput;
        tools?: ClientTool[];
        toolCalls?: FakeToolCalls;
      }) {
        const model = new FakeToolCallingModel({ toolCalls });

        const boundToolNames: string[][] = [];
        const bindTools = model.bindTools.bind(model);
        vi.spyOn(model, "bindTools").mockImplementation((bound) => {
          boundToolNames.push(bound.map(nameOfBoundTool));
          return bindTools(bound);
        });

        const agent = createAgent({
          model,
          tools,
          /**
           * Every form under test is valid input, but overload resolution
           * cannot see that through the union.
           */
          responseFormat: responseFormat as ToolStrategy,
        });
        const result = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });

        return { agent, boundToolNames, result };
      }

      it("should offer the same name on every model request in a loop", async () => {
        const responseFormat = z.object({ answer: z.string() });
        const [{ name: structuredToolName }] = toolStrategy(responseFormat);

        const getWeather = tool(() => "sunny", {
          name: "get_weather",
          description: "Get the weather",
          schema: z.object({}),
        });

        const { boundToolNames, result } = await runAgent({
          responseFormat,
          tools: [getWeather],
          toolCalls: [
            [{ name: "get_weather", args: {}, id: "call_1" }],
            [
              {
                name: structuredToolName,
                args: { answer: "sunny" },
                id: "call_2",
              },
            ],
          ],
        });

        expect(boundToolNames).toHaveLength(2);
        expect(boundToolNames[1]).toEqual(boundToolNames[0]);
        expect(result.structuredResponse).toEqual({ answer: "sunny" });
      });

      it("should offer the same name on a later invocation of the same agent", async () => {
        const { agent, boundToolNames } = await runAgent({
          responseFormat: z.object({ answer: z.string() }),
        });

        /** A second conversation turn, served by the same agent. */
        await agent.invoke({
          messages: [{ role: "user", content: "hi again" }],
        });

        expect(boundToolNames).toHaveLength(2);
        expect(boundToolNames[1]).toEqual(boundToolNames[0]);
      });

      it("should offer the same name for separately constructed identical schemas", async () => {
        const first = await runAgent({
          responseFormat: z.object({ answer: z.string() }),
        });
        const second = await runAgent({
          responseFormat: z.object({ answer: z.string() }),
        });

        expect(first.boundToolNames).toEqual(second.boundToolNames);
      });

      it("should offer different names for different schemas", async () => {
        const answer = await runAgent({
          responseFormat: z.object({ answer: z.string() }),
        });
        const result = await runAgent({
          responseFormat: z.object({ result: z.string() }),
        });

        expect(answer.boundToolNames).not.toEqual(result.boundToolNames);
      });

      it("should offer a different name when a field description changes", async () => {
        const plain = await runAgent({
          responseFormat: z.object({ answer: z.string() }),
        });
        const described = await runAgent({
          responseFormat: z.object({
            answer: z.string().describe("the answer"),
          }),
        });

        expect(plain.boundToolNames).not.toEqual(described.boundToolNames);
      });

      it("should offer a distinctly named tool per entry and parse against the one called", async () => {
        const responseFormat = toolStrategy([
          z.object({ foo: z.string() }),
          z.object({ bar: z.string() }),
        ]);
        const [{ name: fooToolName }, { name: barToolName }] = responseFormat;

        const { boundToolNames, result } = await runAgent({
          responseFormat,
          toolCalls: [
            [{ name: barToolName, args: { bar: "foo" }, id: "call_1" }],
          ],
        });

        expect(boundToolNames[0]).toEqual([fooToolName, barToolName]);
        expect(new Set(boundToolNames[0]).size).toBe(2);
        expect(result.structuredResponse).toEqual({ bar: "foo" });
      });

      it("should offer one tool when the same schema is passed twice", async () => {
        const schema = z.object({ foo: z.string() });
        const responseFormat = toolStrategy([schema, schema]);
        const [{ name: toolName }] = responseFormat;

        const { boundToolNames, result } = await runAgent({
          responseFormat,
          toolCalls: [[{ name: toolName, args: { foo: "bar" }, id: "call_1" }]],
        });

        /**
         * Same-named entries collapse in the agent's name-keyed strategy map,
         * so the model is never offered two indistinguishable tools.
         */
        expect(boundToolNames[0]).toEqual([toolName]);
        expect(result.structuredResponse).toEqual({ foo: "bar" });
      });

      it("should offer the same names for every composition form", async () => {
        const schema = z.object({ answer: z.string() });

        const runs = await Promise.all(
          [
            schema,
            [schema],
            toolStrategy(schema),
            toolStrategy([schema]),
            ToolStrategy.fromSchema(schema),
          ].map((responseFormat) => runAgent({ responseFormat }))
        );

        for (const run of runs) {
          expect(run.boundToolNames).toEqual(runs[0].boundToolNames);
        }
      });

      it("should offer a titled schema under its title", async () => {
        const { boundToolNames } = await runAgent({
          responseFormat: z4
            .object({ answer: z4.string() })
            .meta({ title: "my_custom_tool" }),
        });

        expect(boundToolNames[0]).toEqual(["my_custom_tool"]);
      });

      /**
       * Pinning the literal names is the point here: the promise is that the
       * same schema yields the same name in every process and every release,
       * so a refactor that changes the derivation must fail loudly rather than
       * silently rename every user's tool.
       */
      describe("generated name", () => {
        it("should be pinned for a known Standard Schema", async () => {
          const { boundToolNames } = await runAgent({
            responseFormat: makeSerializableSchema(),
          });

          expect(boundToolNames[0]).toEqual(["extract-b24ae6e238353a13"]);
        });

        it("should be pinned for a known JSON schema", async () => {
          const { boundToolNames } = await runAgent({
            responseFormat: {
              type: "object",
              properties: {
                value: { type: "number" },
              },
            },
          });

          expect(boundToolNames[0]).toEqual(["extract-757afc2191c3f222"]);
        });
      });
    });
  });

  describe("providerStrategy", () => {
    describe("use provider strategy directly", () => {
      it("should not throw error if use provider strategy directly", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: "extract-unmatched", args: { foo: "bar" }, id: "call_2" }],
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

    describe("error handling on parse failure", () => {
      const errorMessage = /did not satisfy the provided response/;

      it("should throw when a terminal response cannot be parsed as JSON", async () => {
        const model = fakeModel().respond(
          new AIMessage({ content: "I cannot answer that question." })
        );
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: providerStrategy(
            z.object({
              temperature: z.number(),
            })
          ),
        });

        await expect(
          agent.invoke({ messages: [{ role: "user", content: "hi" }] })
        ).rejects.toThrow(errorMessage);
      });

      it("should throw when a terminal response is valid JSON but does not satisfy the schema", async () => {
        const model = fakeModel().respond(
          new AIMessage({ content: '{"foo":"bar"}' })
        );
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: providerStrategy(
            z.object({
              temperature: z.number(),
            })
          ),
        });

        await expect(
          agent.invoke({ messages: [{ role: "user", content: "hi" }] })
        ).rejects.toThrow(errorMessage);
      });

      it("should throw when a bare Zod responseFormat auto-promoted to providerStrategy fails to parse", async () => {
        const model = new FakeToolCallingChatModel({
          responses: [
            new AIMessage({ content: "I cannot answer that question." }),
          ],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: z.object({
            temperature: z.number(),
          }),
        });

        await expect(
          agent.invoke({ messages: [{ role: "user", content: "hi" }] })
        ).rejects.toThrow(errorMessage);
      });
    });

    describe("strict flag", () => {
      it("should default to true when strict is not provided", () => {
        const strategy = ProviderStrategy.fromSchema(
          z.object({
            foo: z.string(),
          })
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
        expect(strategyDefault.strict).toBe(true);

        const strategyStrict = providerStrategy({
          schema: z.object({
            foo: z.string(),
          }),
          strict: false,
        });
        expect(strategyStrict.strict).toBe(false);
      });
    });
  });

  describe("Standard Schema support", () => {
    describe("toolStrategy with Standard Schema", () => {
      it("should accept a single Standard Schema", () => {
        const schema = makeSerializableSchema();
        const [strategy] = toolStrategy(schema);

        expect(strategy).toBeInstanceOf(ToolStrategy);
        expect(strategy.schema).toEqual({
          type: "object",
          properties: { foo: { type: "string" } },
          required: ["foo"],
        });
      });

      it("should accept an array of Standard Schemas", () => {
        const schema1 = makeSerializableSchema({
          type: "object",
          properties: { foo: { type: "string" } },
          required: ["foo"],
        });
        const schema2 = makeSerializableSchema({
          type: "object",
          properties: { bar: { type: "number" } },
          required: ["bar"],
        });
        const strategies = toolStrategy([schema1, schema2]);

        expect(strategies).toHaveLength(2);
        expect(strategies[0]).toBeInstanceOf(ToolStrategy);
        expect(strategies[1]).toBeInstanceOf(ToolStrategy);
      });

      it("should return a structured response with Standard Schema via toolStrategy", async () => {
        const schema = makeSerializableSchema();
        const strategies = toolStrategy(schema);
        const [strategy] = strategies;
        const toolName = strategy.name;

        const model = new FakeToolCallingModel({
          toolCalls: [[{ name: toolName, args: { foo: "bar" }, id: "call_1" }]],
        });
        const agent = createAgent({
          model,
          tools: [],
          responseFormat: strategies,
        });

        const res = await agent.invoke({
          messages: [{ role: "user", content: "hi" }],
        });

        expect(res.structuredResponse).toEqual({ foo: "bar" });
      });
    });

    describe("providerStrategy with Standard Schema", () => {
      it("should accept a Standard Schema directly", () => {
        const schema = makeSerializableSchema();
        const strategy = providerStrategy(schema);

        expect(strategy).toBeInstanceOf(ProviderStrategy);
        expect(strategy.schema).toEqual({
          type: "object",
          properties: { foo: { type: "string" } },
          required: ["foo"],
        });
      });

      it("should accept a Standard Schema in options object", () => {
        const schema = makeSerializableSchema();
        const strategy = providerStrategy({ schema, strict: false });

        expect(strategy).toBeInstanceOf(ProviderStrategy);
        expect(strategy.strict).toBe(false);
      });
    });

    describe("ProviderStrategy.parse", () => {
      const parseSchema = z.object({ result: z.string() });

      it("should parse structured output from a plain string response", () => {
        const strategy = providerStrategy(parseSchema);
        const parsed = strategy.parse(
          new AIMessage({ content: JSON.stringify({ result: "ok" }) })
        );
        expect(parsed).toEqual({ result: "ok" });
      });

      it("should parse structured output from the first text block in array content", () => {
        const strategy = providerStrategy(parseSchema);
        const parsed = strategy.parse(
          new AIMessage({
            content: [{ type: "text", text: JSON.stringify({ result: "ok" }) }],
          })
        );
        expect(parsed).toEqual({ result: "ok" });
      });

      it("should skip a leading thought text block and parse the structured response", () => {
        // Regression test for #11435: @langchain/google represents a Gemini
        // thought summary as `{ type: "text", thought: true }` followed by the
        // structured JSON block. parse() must ignore the thought block.
        const strategy = providerStrategy(parseSchema);
        const parsed = strategy.parse(
          new AIMessage({
            content: [
              {
                type: "text",
                thought: true,
                text: "A returned thought summary.",
              },
              { type: "text", text: JSON.stringify({ result: "ok" }) },
            ],
          })
        );
        expect(parsed).toEqual({ result: "ok" });
      });
    });

    describe("ToolStrategy.fromSchema with Standard Schema", () => {
      it("should create a ToolStrategy from a Standard Schema", () => {
        const schema = makeSerializableSchema({
          type: "object",
          title: "my_standard_tool",
          properties: { foo: { type: "string" } },
          required: ["foo"],
        });
        const strategy = ToolStrategy.fromSchema(schema);

        expect(strategy.name).toBe("my_standard_tool");
        expect(strategy.schema).toEqual({
          type: "object",
          title: "my_standard_tool",
          properties: { foo: { type: "string" } },
          required: ["foo"],
        });
      });
    });

    describe("ProviderStrategy.fromSchema with Standard Schema", () => {
      it("should create a ProviderStrategy from a Standard Schema", () => {
        const schema = makeSerializableSchema();
        const strategy = ProviderStrategy.fromSchema(schema);

        expect(strategy).toBeInstanceOf(ProviderStrategy);
        expect(strategy.schema).toEqual({
          type: "object",
          properties: { foo: { type: "string" } },
          required: ["foo"],
        });
        expect(strategy.strict).toBe(true);
      });
    });
  });
});

describe("hasSupportForJsonSchemaOutput", () => {
  it("should return false for undefined model", () => {
    expect(hasSupportForJsonSchemaOutput(undefined)).toBe(false);
  });

  it("should use model.profile.structuredOutput to determine support", () => {
    const model = new FakeToolCallingModel({});
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
    const model2 = new FakeToolCallingChatModel({});
    expect(hasSupportForJsonSchemaOutput(model2)).toBe(true);
  });

  it("should return true for OpenAI models whose profile reports structuredOutput", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(true);
  });

  it("should return false for OpenAI models whose profile does not report structuredOutput", () => {
    const model = new ChatOpenAI({
      model: "gpt-3.5-turbo",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
  });

  it("should return false for Anthropic models whose profile does not report structuredOutput", () => {
    const model = new ChatAnthropic({
      model: "claude-sonnet-4-5-20250929",
      anthropicApiKey: "foobar",
    });
    expect(hasSupportForJsonSchemaOutput(model)).toBe(false);
  });
});

describe("native structured output does not force strict tools", () => {
  const echo = tool(async () => "ok", {
    name: "echo",
    description: "Echo the text.",
    schema: z.object({ text: z.string(), times: z.number().optional() }),
  });
  const schema = z.object({ answer: z.string() });

  /** Spy on bindTools, run the agent, and return the options it bound with. */
  async function bindOptions(
    responseFormat: ProviderStrategy<Record<string, unknown>>,
    middleware?: Parameters<typeof createAgent>[0]["middleware"]
  ) {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage('{"answer":"ok"}')],
    });
    const bindTools = vi.spyOn(model, "bindTools");
    const agent = createAgent({
      model,
      tools: [echo],
      responseFormat,
      middleware,
    });
    await agent.invoke({ messages: [new HumanMessage("hi")] });
    // `bindTools` is declared with a single `tools` param, but the agent passes
    // call options as a 2nd argument at runtime. Widen the captured call to read
    // the `strict` flag and `response_format` it bound with.
    const [, options] = bindTools.mock.calls[0] as unknown as [
      unknown,
      { strict?: boolean; response_format?: unknown } | undefined,
    ];
    return options ?? {};
  }

  it("leaves tools non-strict for a default ProviderStrategy (strict defaults true)", async () => {
    const opts = await bindOptions(ProviderStrategy.fromSchema(schema));
    expect(opts.strict).toBeUndefined();
    expect(opts.response_format).toBeDefined(); // native output still requested
  });

  it("honors an explicit modelSettings.strict override", async () => {
    const forceStrict = createMiddleware({
      name: "forceStrict",
      wrapModelCall: async (request, handler) =>
        handler({ ...request, modelSettings: { strict: true } }),
    });
    const opts = await bindOptions(ProviderStrategy.fromSchema(schema), [
      forceStrict,
    ]);
    expect(opts.strict).toBe(true);
  });

  it("keeps tools non-strict for an explicit providerStrategy strict: false", async () => {
    const opts = await bindOptions(ProviderStrategy.fromSchema(schema, false));
    expect(opts.strict).toBeUndefined();
  });
});
