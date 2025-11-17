import { describe, expect, test, vi } from "vitest";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatBedrockConverse } from "../chat_models.js";
import type {
  ConverseCommandInput,
  ConverseStreamCommandInput,
} from "@aws-sdk/client-bedrock-runtime";

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  class ConverseCommand {
    input: ConverseCommandInput;
    static lastInput: ConverseCommandInput;
    constructor(input: ConverseCommandInput) {
      this.input = input;
      ConverseCommand.lastInput = input;
    }
  }
  class ConverseStreamCommand {
    input: ConverseStreamCommandInput;
    static lastInput: ConverseStreamCommandInput;
    constructor(input: ConverseStreamCommandInput) {
      this.input = input;
      ConverseStreamCommand.lastInput = input;
    }
  }
  class BedrockRuntimeClient {
    async send(command: unknown) {
      // Non-stream path
      if (
        (command as { constructor?: unknown })?.constructor === ConverseCommand
      ) {
        return {
          output: {
            message: {
              role: "assistant",
              content: [{ text: "Response" }],
            },
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
        };
      }
      // Stream path
      if (
        (command as { constructor?: unknown })?.constructor ===
        ConverseStreamCommand
      ) {
        return {
          stream: (async function* () {
            yield {
              contentBlockDelta: {
                contentBlockIndex: 0,
                delta: { text: "Response" },
              },
            };
            yield {
              metadata: {
                usage: {
                  inputTokens: 10,
                  outputTokens: 5,
                  totalTokens: 15,
                },
              },
            };
          })(),
        };
      }
      return {};
    }
  }
  return {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseStreamCommand,
  };
});

import {
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

describe("ChatBedrockConverse invocationParams", () => {
  const baseConstructorArgs = {
    region: "us-east-1",
    credentials: {
      secretAccessKey: "test-secret",
      accessKeyId: "test-key",
    },
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
  };

  describe("inferenceConfig conditional logic", () => {
    test("covers all inferenceConfig scenarios compactly", () => {
      const cases: Array<{
        name: string;
        ctor?: Partial<ConstructorParameters<typeof ChatBedrockConverse>[0]>;
        opts?: Parameters<ChatBedrockConverse["invocationParams"]>[0];
        expectDefined: boolean;
        expectValues?: Partial<{
          maxTokens: number;
          temperature: number;
          topP: number;
          stopSequences: string[];
        }>;
        expectUndefinedKeys?: Array<
          "maxTokens" | "temperature" | "topP" | "stopSequences"
        >;
      }> = [
        {
          name: "undefined when no inference values are set",
          expectDefined: false,
        },
        {
          name: "includes only maxTokens when set",
          ctor: { maxTokens: 100 },
          expectDefined: true,
          expectValues: { maxTokens: 100 },
          expectUndefinedKeys: ["temperature", "topP", "stopSequences"],
        },
        {
          name: "includes only temperature when set",
          ctor: { temperature: 0.7 },
          expectDefined: true,
          expectValues: { temperature: 0.7 },
          expectUndefinedKeys: ["maxTokens", "topP", "stopSequences"],
        },
        {
          name: "includes only topP when set",
          ctor: { topP: 0.9 },
          expectDefined: true,
          expectValues: { topP: 0.9 },
          expectUndefinedKeys: ["maxTokens", "temperature", "stopSequences"],
        },
        {
          name: "includes stopSequences when provided",
          opts: { stop: ["END", "STOP"] },
          expectDefined: true,
          expectValues: { stopSequences: ["END", "STOP"] },
          expectUndefinedKeys: ["maxTokens", "temperature", "topP"],
        },
        {
          name: "includes all values when all are set",
          ctor: { maxTokens: 200, temperature: 0.5, topP: 0.95 },
          opts: { stop: ["END"] },
          expectDefined: true,
          expectValues: {
            maxTokens: 200,
            temperature: 0.5,
            topP: 0.95,
            stopSequences: ["END"],
          },
        },
        {
          name: "undefined when stop sequences is empty array",
          opts: { stop: [] },
          expectDefined: false,
        },
      ];

      for (const c of cases) {
        const model = new ChatBedrockConverse({
          ...baseConstructorArgs,
          ...(c.ctor ?? {}),
        });
        const params = model.invocationParams(c.opts);
        if (!c.expectDefined) {
          expect(params.inferenceConfig).toBeUndefined();
        } else {
          expect(params.inferenceConfig).toBeDefined();
          if (c.expectValues?.maxTokens !== undefined) {
            expect(params.inferenceConfig?.maxTokens).toBe(
              c.expectValues.maxTokens
            );
          }
          if (c.expectValues?.temperature !== undefined) {
            expect(params.inferenceConfig?.temperature).toBe(
              c.expectValues.temperature
            );
          }
          if (c.expectValues?.topP !== undefined) {
            expect(params.inferenceConfig?.topP).toBe(c.expectValues.topP);
          }
          if (c.expectValues?.stopSequences !== undefined) {
            expect(params.inferenceConfig?.stopSequences).toEqual(
              c.expectValues.stopSequences
            );
          }
          const ic = params.inferenceConfig as Record<
            "maxTokens" | "temperature" | "topP" | "stopSequences",
            unknown
          >;
          for (const k of c.expectUndefinedKeys ?? []) {
            expect(ic?.[k]).toBeUndefined();
          }
        }
      }
    });
  });

  describe("system parameter conditional logic", () => {
    test.each([
      {
        name: "no system messages",
        messages: [new HumanMessage("Hello")],
        expectedSystem: { present: false, length: 0, texts: [] as string[] },
      },
      {
        name: "one system message",
        messages: [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Hello"),
        ],
        expectedSystem: {
          present: true,
          length: 1,
          texts: ["You are a helpful assistant."],
        },
      },
      {
        name: "multiple system messages",
        messages: [
          new SystemMessage("You are a helpful assistant."),
          new SystemMessage("Be concise in your responses."),
          new HumanMessage("Hello"),
        ],
        expectedSystem: {
          present: true,
          length: 2,
          texts: [
            "You are a helpful assistant.",
            "Be concise in your responses.",
          ],
        },
      },
    ])(
      "invoke should handle system parameter: $name",
      async ({ messages, expectedSystem }) => {
        const model = new ChatBedrockConverse(baseConstructorArgs);
        await model.invoke(messages);
        const input = Reflect.get(
          ConverseCommand,
          "lastInput"
        ) as ConverseCommandInput;
        if (expectedSystem.present) {
          expect(input).toHaveProperty("system");
          const system = input.system as NonNullable<typeof input.system>;
          expect(system).toHaveLength(expectedSystem.length);
          expectedSystem.texts.forEach((t, i) => {
            expect(system[i]).toHaveProperty("text", t);
          });
        } else {
          expect(input).not.toHaveProperty("system");
        }
      }
    );
  });

  describe("stream method system parameter logic", () => {
    test.each([
      {
        name: "no system messages",
        messages: [new HumanMessage("Hello")],
        expectedPresent: false,
        expectedLength: 0,
        expectedTexts: [] as string[],
      },
      {
        name: "one system message",
        messages: [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Hello"),
        ],
        expectedPresent: true,
        expectedLength: 1,
        expectedTexts: ["You are a helpful assistant."],
      },
    ])(
      "stream should handle system parameter: $name",
      async ({ messages, expectedPresent, expectedLength, expectedTexts }) => {
        const model = new ChatBedrockConverse(baseConstructorArgs);
        const stream = await model.stream(messages);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        expect(chunks.length).toBeGreaterThan(0);
        const input = Reflect.get(
          ConverseStreamCommand,
          "lastInput"
        ) as ConverseStreamCommandInput;
        if (expectedPresent) {
          expect(input).toHaveProperty("system");
          const system = input.system as NonNullable<typeof input.system>;
          expect(system).toHaveLength(expectedLength);
          expectedTexts.forEach((t: string, i: number) => {
            expect(system[i]).toHaveProperty("text", t);
          });
        } else {
          expect(input).not.toHaveProperty("system");
        }
      }
    );
  });
});
