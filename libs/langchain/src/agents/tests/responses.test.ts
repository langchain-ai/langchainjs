import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createReactAgent, toolStrategy } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("structured output handling", () => {
  describe("toolStrategy", () => {
    describe("multiple structured output tool calls", () => {
      it("should throw if no error handler is provided", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              /**
               * `extract-3` and `extract-5` are the computed function names for the json schemas
               */
              { name: "extract-1", args: { foo: "foo" }, id: "call_1" },
              { name: "extract-2", args: { bar: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createReactAgent({
          llm: model,
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

        await expect(
          agent.invoke({
            messages: [{ role: "user", content: "hi" }],
          })
        ).rejects.toThrow("The model has called multiple tools");
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
        const agent = createReactAgent({
          llm: model,
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
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              { name: "extract-5", args: { foo: "foo" }, id: "call_1" },
              { name: "extract-6", args: { bar: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createReactAgent({
          llm: model,
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

        expect(res.messages).toHaveLength(3);
        expect(res.messages[0].content).toContain("hi!");
        expect(res.messages[1].content).toContain("hi!");
        expect(res.messages[2].content).toContain(
          "The model has called multiple tools"
        );
      });

      it("should retry if the error handler is set to the MultipleStructuredOutputsError", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              { name: "extract-7", args: { foo: "foo" }, id: "call_1" },
              { name: "extract-8", args: { bar: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createReactAgent({
          llm: model,
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

        expect(res.messages[0].content).toContain("hi!");
        expect(res.messages[1].content).toContain("hi!");
        expect(res.messages[2].content).toContain("foobar");
      });

      it("should throw if error handler throws an error", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [
              { name: "extract-9", args: { foo: "foo" }, id: "call_1" },
              { name: "extract-10", args: { bar: "bar" }, id: "call_2" },
            ],
          ],
        });
        const agent = createReactAgent({
          llm: model,
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
      it("should throw if error handler is set to true", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: "extract-11", args: { bar: "foo" }, id: "call_1" }],
          ],
        });
        const agent = createReactAgent({
          llm: model,
          tools: [],
          responseFormat: toolStrategy(
            z.object({
              foo: z.string(),
            })
          ),
        });

        await expect(
          agent.invoke({
            messages: [{ role: "user", content: "hi" }],
          })
        ).rejects.toThrow("Failed to parse structured output");
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
        const agent = createReactAgent({
          llm: model,
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

        const agent = createReactAgent({
          llm: model,
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
         * 2. The tool message
         * 3. The structured response message
         */
        expect(res.messages.length).toBe(3);
        expect(res.messages.at(-1)?.content).toContain("foobar");
      });

      it("should return structured response if it matches one of the schemas", async () => {
        const model = new FakeToolCallingModel({
          toolCalls: [
            [{ name: "extract-15", args: { bar: "foo" }, id: "call_1" }],
          ],
        });
        const agent = createReactAgent({
          llm: model,
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
});
