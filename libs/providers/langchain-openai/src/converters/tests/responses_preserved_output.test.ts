/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { convertMessagesToResponsesInput } from "../responses.js";

describe("convertMessagesToResponsesInput preserved output for v1 messages", () => {
  it("replays preserved output items verbatim for messages assembled from content blocks", () => {
    const output = [
      { type: "reasoning", id: "rs_123", summary: [] },
      {
        type: "message",
        id: "msg_123",
        role: "assistant",
        status: "completed",
        content: [
          { type: "output_text", text: "Let me check.", annotations: [] },
        ],
      },
      {
        type: "function_call",
        id: "fc_abc",
        call_id: "call_abc",
        name: "get_weather",
        arguments: '{"city":"Paris"}',
        status: "completed",
      },
    ];
    // Messages assembled by the content-block streaming protocol
    // (model.streamEvents without a version) are stamped with
    // output_version "v1", which previously forced reconstruction from
    // content blocks and dropped the reasoning item from the replayed
    // input.
    const message = new AIMessage({
      content: [{ type: "text", text: "Let me check." }],
      response_metadata: {
        output_version: "v1",
        model_provider: "openai",
        output,
      },
      additional_kwargs: {
        reasoning: { type: "reasoning", id: "rs_123", summary: [] },
      },
    });

    const replayInput = convertMessagesToResponsesInput({
      messages: [message],
      zdrEnabled: false,
      model: "gpt-5",
    });

    expect(replayInput).toEqual(output);
  });
});
