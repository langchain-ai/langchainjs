import { describe, expect, it } from "vitest";
import { AIMessage } from "../../ai.js";

describe("ChatVertexTranslator", () => {
  it("should translate thinking blocks to reasoning content blocks", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Let me analyze this carefully...",
          signature: "sig123",
        },
        {
          type: "text",
          text: "Based on my analysis, the answer is 42",
        },
      ],
      response_metadata: { model_provider: "google-vertexai" },
    });

    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Let me analyze this carefully...",
        signature: "sig123",
      },
      { type: "text", text: "Based on my analysis, the answer is 42" },
    ]);
  });

  it("should translate thinking blocks without signature", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Processing the query...",
        },
        {
          type: "text",
          text: "Here is my response",
        },
      ],
      response_metadata: { model_provider: "google-vertexai" },
    });

    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Processing the query...",
      },
      { type: "text", text: "Here is my response" },
    ]);
  });

  it("should translate ChatVertex messages to standard content blocks", () => {
    const message = new AIMessage({
      content: [
        { type: "reasoning", reasoning: "I think the answer is 42" },
        { type: "reasoning", reasoning: "I think the answer is not 42" },
        { type: "text", text: "The answer is 42" },
        {
          type: "image_url",
          image_url:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=",
        },
        { type: "image_url", image_url: "https://example.com/image.png" },
        {
          type: "media",
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=",
        },
      ],
      additional_kwargs: {
        signatures: ["foo"],
      },
      response_metadata: {
        model_provider: "google-vertexai",
      },
    });
    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "I think the answer is 42",
        signature: "foo",
      },
      {
        type: "reasoning",
        reasoning: "I think the answer is not 42",
      },
      { type: "text", text: "The answer is 42" },
      {
        type: "image",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=",
        mimeType: "image/png",
      },
      { type: "image", url: "https://example.com/image.png" },
      {
        type: "file",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=",
        mimeType: "image/png",
      },
    ]);
  });
});
