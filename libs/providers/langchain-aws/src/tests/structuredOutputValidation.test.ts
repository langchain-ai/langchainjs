import { describe, expect, test } from "vitest";
import * as z from "zod";
import { OutputParserException } from "@langchain/core/output_parsers";
import type { AIMessage } from "@langchain/core/messages";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { ChatBedrockConverse } from "../chat_models.js";

const schema = z.object({ priority: z.enum(["low", "high"]) });

/**
 * Returns a ChatBedrockConverse whose transport is stubbed at the SDK layer, so
 * the model "answers" with whatever tool input the test supplies and no AWS
 * credentials are needed.
 */
function modelReturning(toolInput: Record<string, unknown>) {
  const client = new BedrockRuntimeClient({ region: "eu-central-1" });
  client.send = (async () => ({
    output: {
      message: {
        role: "assistant",
        content: [
          {
            toolUse: { toolUseId: "call-1", name: "ticket", input: toolInput },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  })) as typeof client.send;

  return new ChatBedrockConverse({
    model: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
    region: "eu-central-1",
    client,
  });
}

describe("ChatBedrockConverse.withStructuredOutput schema validation", () => {
  test("rejects a tool call that violates the schema", async () => {
    const model = modelReturning({ priority: "whenever" });

    // The parser used to hand the tool-call arguments back with a bare cast, so
    // an invalid answer reached the caller typed as if it had been validated.
    await expect(
      model.withStructuredOutput(schema, { name: "ticket" }).invoke("classify")
    ).rejects.toThrow(OutputParserException);
  });

  test("still returns a conforming tool call", async () => {
    const model = modelReturning({ priority: "high" });

    await expect(
      model.withStructuredOutput(schema, { name: "ticket" }).invoke("classify")
    ).resolves.toEqual({ priority: "high" });
  });

  test("surfaces the failure as parsed: null under includeRaw", async () => {
    const model = modelReturning({ priority: "whenever" });

    const result = await model
      .withStructuredOutput(schema, { name: "ticket", includeRaw: true })
      .invoke("classify");

    expect(result.parsed).toBeNull();
    expect((result.raw as AIMessage).tool_calls?.[0]?.args).toEqual({
      priority: "whenever",
    });
  });
});
