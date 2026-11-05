/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod/v4";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ModelRefusalError } from "@langchain/core/errors";
import {
  convertCompletionsDeltaToBaseMessageChunk,
  convertCompletionsMessageToBaseMessage,
  convertMessagesToCompletionsMessageParams,
} from "../completions.js";
import { convertMessagesToResponsesInput } from "../responses.js";
import { ChatOpenAI } from "../../chat_models/index.js";

const rawResponse = { id: "chatcmpl-1", model: "gpt-4o", choices: [] } as any;

describe("Chat Completions refusals", () => {
  it("keeps a refusal from a response", () => {
    const message = convertCompletionsMessageToBaseMessage({
      message: { role: "assistant", content: null, refusal: "No." } as any,
      rawResponse,
    }) as AIMessage;

    expect(message.additional_kwargs.refusal).toBe("No.");
    expect(message.contentBlocks).toContainEqual({
      type: "refusal",
      refusal: "No.",
    });
  });

  it("keeps a refusal from a stream delta", () => {
    const chunk = convertCompletionsDeltaToBaseMessageChunk({
      delta: { role: "assistant", refusal: "No." } as any,
      rawResponse,
    });

    expect(chunk.additional_kwargs.refusal).toBe("No.");
  });

  it("sends a refusal block back without extras", () => {
    const params = convertMessagesToCompletionsMessageParams({
      messages: [
        new HumanMessage("Hi"),
        new AIMessage({
          content: [
            { type: "refusal", refusal: "No.", extras: { category: "x" } },
          ],
        }),
      ],
      model: "gpt-4o",
    }) as any[];

    expect(params[1].content).toEqual([{ type: "refusal", refusal: "No." }]);
  });
});

describe("Chat Completions refusal replay", () => {
  it("sends a refusal kept in additional_kwargs", () => {
    const params = convertMessagesToCompletionsMessageParams({
      messages: [
        new AIMessage({ content: "", additional_kwargs: { refusal: "No." } }),
      ],
      model: "gpt-4o",
    }) as any[];

    expect(params[0].refusal).toBe("No.");
  });

  it("concatenates streamed refusal deltas", () => {
    const chunks = ["I can", "not help."].map((refusal) =>
      convertCompletionsDeltaToBaseMessageChunk({
        delta: { role: "assistant", refusal } as any,
        rawResponse,
      })
    );

    expect(chunks[0].concat(chunks[1]).additional_kwargs.refusal).toBe(
      "I cannot help."
    );
  });

  it("drops refusal blocks from non-assistant messages", () => {
    const params = convertMessagesToCompletionsMessageParams({
      messages: [
        new HumanMessage({
          content: [
            { type: "text", text: "Hi" },
            { type: "refusal", refusal: "No." } as any,
          ],
        }),
      ],
      model: "gpt-4o",
    }) as any[];

    expect(params[0].content).toEqual([{ type: "text", text: "Hi" }]);
  });

  it("sends a v1 refusal block as the refusal field", () => {
    const params = convertMessagesToCompletionsMessageParams({
      messages: [
        new AIMessage({
          content: [{ type: "refusal", refusal: "No." }],
          response_metadata: { output_version: "v1" },
        }),
      ],
      model: "gpt-4o",
    }) as any[];

    expect(params[0]).toMatchObject({
      role: "assistant",
      content: null,
      refusal: "No.",
    });
  });
});

describe("Responses refusals", () => {
  it("normalizes a refusal block and does not duplicate it", () => {
    const input = convertMessagesToResponsesInput({
      messages: [
        new AIMessage({
          id: "msg_1",
          content: [
            { type: "refusal", refusal: "No.", extras: { category: "x" } },
          ],
          additional_kwargs: { refusal: "No." },
        }),
      ],
      zdrEnabled: false,
      model: "gpt-4o",
    }) as any[];

    const parts = input.flatMap((item) =>
      Array.isArray(item.content) ? item.content : []
    );
    expect(parts.filter((part) => part.type === "refusal")).toEqual([
      { type: "refusal", refusal: "No." },
    ]);
  });

  it("still sends a refusal kept only in additional_kwargs", () => {
    const input = convertMessagesToResponsesInput({
      messages: [
        new AIMessage({
          id: "msg_1",
          content: "",
          additional_kwargs: { refusal: "No." },
        }),
      ],
      zdrEnabled: false,
      model: "gpt-4o",
    }) as any[];

    const parts = input.flatMap((item) =>
      Array.isArray(item.content) ? item.content : []
    );
    expect(parts).toContainEqual({ type: "refusal", refusal: "No." });
  });
});

describe("Responses v1 refusal replay", () => {
  it("sends a v1 refusal block as a refusal part", () => {
    const input = convertMessagesToResponsesInput({
      messages: [
        new AIMessage({
          content: [{ type: "refusal", refusal: "No." }],
          response_metadata: { output_version: "v1" },
        }),
      ],
      zdrEnabled: false,
      model: "gpt-4o",
    }) as any[];

    const parts = input.flatMap((item) =>
      Array.isArray(item.content) ? item.content : []
    );
    expect(parts).toEqual([{ type: "refusal", refusal: "No." }]);
  });
});

describe("structured output refusals", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("raises ModelRefusalError with the jsonSchema method", async () => {
    const refused = new AIMessage({
      content: "",
      additional_kwargs: { refusal: "No." },
      response_metadata: { model_provider: "openai" },
    });
    vi.spyOn(ChatOpenAI.prototype as any, "_generate").mockResolvedValue({
      generations: [{ text: "", message: refused }],
    });
    const model = new ChatOpenAI({ model: "gpt-4o", apiKey: "test" });
    const structured = model.withStructuredOutput(
      z.object({ answer: z.string() }),
      { method: "jsonSchema" }
    );

    const error = await structured.invoke("Hi").catch((e: unknown) => e);
    expect(ModelRefusalError.isInstance(error)).toBe(true);
    expect((error as ModelRefusalError).rawMessage).toBe(refused);
  });
});
