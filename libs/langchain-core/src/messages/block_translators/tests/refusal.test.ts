import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../../ai.js";

const refusals = (message: AIMessage) =>
  message.contentBlocks.filter((block) => block.type === "refusal");

describe("OpenAI refusals", () => {
  it("reads a Chat Completions refusal from additional_kwargs", () => {
    const message = new AIMessage({
      content: "",
      additional_kwargs: { refusal: "I can't help with that." },
      response_metadata: { model_provider: "openai" },
    });
    expect(refusals(message)).toEqual([
      { type: "refusal", refusal: "I can't help with that." },
    ]);
  });

  it("reads a streamed Chat Completions refusal", () => {
    const chunk = new AIMessageChunk({
      content: "",
      additional_kwargs: { refusal: "No." },
      response_metadata: { model_provider: "openai" },
    });
    expect(refusals(chunk)).toEqual([{ type: "refusal", refusal: "No." }]);
  });

  it("reads a Responses refusal content part once", () => {
    const message = new AIMessage({
      content: [{ type: "refusal", refusal: "No.", id: "msg_1" }],
      additional_kwargs: { refusal: "No." },
      response_metadata: { model_provider: "openai" },
    });
    expect(refusals(message)).toEqual([
      { type: "refusal", refusal: "No.", id: "msg_1" },
    ]);
  });

  it("reads a Responses refusal stored in additional_kwargs", () => {
    const message = new AIMessage({
      content: [{ type: "text", text: "Here is" }],
      additional_kwargs: { refusal: "No." },
      response_metadata: { model_provider: "openai" },
    });
    expect(message.contentBlocks).toEqual([
      { type: "text", text: "Here is" },
      { type: "refusal", refusal: "No." },
    ]);
  });

  it("ignores an empty refusal", () => {
    const message = new AIMessage({
      content: "Hello",
      additional_kwargs: { refusal: "" },
      response_metadata: { model_provider: "openai" },
    });
    expect(refusals(message)).toEqual([]);
  });
});

describe("Anthropic refusals", () => {
  it("builds a refusal from stop_reason and stop_details", () => {
    const message = new AIMessage({
      content: [],
      response_metadata: {
        model_provider: "anthropic",
        stop_reason: "refusal",
        stop_details: {
          type: "refusal",
          category: "cyber",
          explanation: "Blocked under the usage policy.",
        },
      },
    });
    expect(refusals(message)).toEqual([
      {
        type: "refusal",
        refusal: "Blocked under the usage policy.",
        extras: { category: "cyber" },
      },
    ]);
  });

  it("keeps partial text before the refusal", () => {
    const message = new AIMessage({
      content: "Here is",
      response_metadata: {
        model_provider: "anthropic",
        stop_reason: "refusal",
      },
    });
    expect(message.contentBlocks).toEqual([
      { type: "text", text: "Here is" },
      { type: "refusal", refusal: "" },
    ]);
  });

  it("does not duplicate a stored refusal block", () => {
    const message = new AIMessage({
      content: [{ type: "refusal", refusal: "No." }],
      response_metadata: {
        model_provider: "anthropic",
        stop_reason: "refusal",
      },
    });
    expect(refusals(message)).toEqual([{ type: "refusal", refusal: "No." }]);
  });

  it("tolerates malformed stop_details", () => {
    const message = new AIMessage({
      content: [],
      response_metadata: {
        model_provider: "anthropic",
        stop_reason: "refusal",
        stop_details: "unexpected",
      },
    });
    expect(refusals(message)).toEqual([{ type: "refusal", refusal: "" }]);
  });

  it("is not a refusal on a normal stop", () => {
    const message = new AIMessage({
      content: "Hi.",
      response_metadata: {
        model_provider: "anthropic",
        stop_reason: "end_turn",
      },
    });
    expect(refusals(message)).toEqual([]);
  });
});

describe.each(["google", "google-genai", "google-vertexai"])(
  "Gemini refusals (%s)",
  (provider) => {
    it.each(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"])(
      "treats finishReason %s as a refusal",
      (finishReason) => {
        const message = new AIMessage({
          content: "",
          response_metadata: {
            model_provider: provider,
            finishReason,
            finishMessage: "Blocked.",
          },
        });
        expect(refusals(message)).toEqual([
          { type: "refusal", refusal: "Blocked.", extras: { finishReason } },
        ]);
      }
    );

    it("treats a prompt block reason as a refusal", () => {
      const message = new AIMessage({
        content: "",
        response_metadata: {
          model_provider: provider,
          promptFeedback: { blockReason: "SAFETY" },
        },
      });
      expect(refusals(message)).toEqual([
        { type: "refusal", refusal: "", extras: { blockReason: "SAFETY" } },
      ]);
    });

    it.each(["STOP", "MAX_TOKENS", "RECITATION"])(
      "does not treat finishReason %s as a refusal",
      (finishReason) => {
        const message = new AIMessage({
          content: "Hi.",
          response_metadata: { model_provider: provider, finishReason },
        });
        expect(refusals(message)).toEqual([]);
      }
    );

    it("ignores an unspecified block reason", () => {
      const message = new AIMessage({
        content: "Hi.",
        response_metadata: {
          model_provider: provider,
          promptFeedback: { blockReason: "BLOCKED_REASON_UNSPECIFIED" },
        },
      });
      expect(refusals(message)).toEqual([]);
    });
  }
);

describe("v1 messages", () => {
  it("returns a stored refusal block as is", () => {
    const message = new AIMessage({
      content: [
        { type: "text", text: "Here is" },
        { type: "refusal", refusal: "No." },
      ],
      response_metadata: { model_provider: "openai", output_version: "v1" },
    });
    expect(refusals(message)).toEqual([{ type: "refusal", refusal: "No." }]);
  });
});
