import { describe, expect, test } from "vitest";
import { ModelRefusalError } from "@langchain/core/errors";
import {
  AIMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { Question } from "@langchain/core/decisions";
import {
  convertContentToDecisionsInstructions,
  convertDecisionsResponseToClassifierResponse,
  convertQuestionsToDecisionsQuestions,
  convertStateToDecisionsInput,
} from "../../converters/decisions/index.js";
import {
  decisionBlockedErrorFromErrorBody,
  InvalidInputError,
  MalformedOutputError,
  PromptBlockedError,
  PromptRefusedError,
} from "../../utils/errors.js";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("convertStateToDecisionsInput", () => {
  test("passes non-empty strings through unchanged", () => {
    expect(convertStateToDecisionsInput("Order #42 arrived cracked.")).toBe(
      "Order #42 arrived cracked."
    );
  });

  test("rejects empty or non-container scalar root states", () => {
    expect(() => convertStateToDecisionsInput("")).toThrow(InvalidInputError);
    expect(() =>
      convertStateToDecisionsInput(null as unknown as string)
    ).toThrow(InvalidInputError);
    expect(() =>
      convertStateToDecisionsInput(undefined as unknown as string)
    ).toThrow(InvalidInputError);
    expect(() => convertStateToDecisionsInput(42 as unknown as string)).toThrow(
      InvalidInputError
    );
  });

  test("serializes plain JSON objects, Dates, and pure JSON arrays", () => {
    const state = {
      order_id: "ord_123",
      amount: 49.95,
      flagged: true,
      notes: null,
      created_at: new Date("2026-05-01T12:00:00.000Z") as unknown as string,
      tags: ["fragile", "express"],
    };
    expect(convertStateToDecisionsInput(state)).toBe(
      JSON.stringify({
        order_id: "ord_123",
        amount: 49.95,
        flagged: true,
        notes: null,
        created_at: "2026-05-01T12:00:00.000Z",
        tags: ["fragile", "express"],
      })
    );

    expect(convertStateToDecisionsInput([{ id: 1 }, { id: 2 }])).toBe(
      '[{"id":1},{"id":2}]'
    );
  });

  test("rejects circular references without echoing caller property names", () => {
    const secretObj: Record<string, unknown> = {
      superSecretFieldName: "classified",
    };
    secretObj.selfRef = secretObj;

    try {
      convertStateToDecisionsInput(
        secretObj as unknown as Record<string, string>
      );
      expect.unreachable("Expected InvalidInputError");
    } catch (error) {
      expect(InvalidInputError.isInstance(error)).toBe(true);
      expect((error as Error).message).not.toContain("superSecretFieldName");
      expect((error as Error).message).not.toContain("selfRef");
    }
  });

  test("rejects NaN and Infinity inside JSON state", () => {
    expect(() => convertStateToDecisionsInput({ score: Number.NaN })).toThrow(
      InvalidInputError
    );
    expect(() =>
      convertStateToDecisionsInput({ score: Number.POSITIVE_INFINITY })
    ).toThrow(InvalidInputError);
  });

  test("renders text-only BaseMessage conversations preserving roles, tool calls, and refusals", () => {
    const messages = [
      new SystemMessage("Follow the warehouse refund policy."),
      new HumanMessage({
        content: [
          { type: "text", text: "Please delete temporary logs." },
          { type: "text", text: "Also refund order #7." },
        ],
      }),
      new AIMessage({
        content: [
          { type: "text", text: "Checking order #7 first." },
          { type: "text", text: "Fetching warehouse record." },
          // Duplicate v1 tool_call block should not be rendered twice when tool_calls is set
          {
            type: "tool_call",
            id: "call_1",
            name: "lookup_order",
            args: { orderId: "7" },
          },
        ],
        tool_calls: [
          {
            id: "call_1",
            name: "lookup_order",
            args: { orderId: "7" },
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        tool_call_id: "call_1",
        name: "lookup_order",
        content: '{"status":"delivered","damaged":true}',
      }),
      new AIMessage({
        content: "",
        additional_kwargs: { refusal: "Cannot delete production logs." },
      }),
      new ChatMessage("Escalated to supervisor.", "moderator"),
    ];

    const rendered = convertStateToDecisionsInput(messages);
    expect(rendered).toBe(
      [
        "system: Follow the warehouse refund policy.",
        "user: Please delete temporary logs.\nAlso refund order #7.",
        'assistant: Checking order #7 first.\nFetching warehouse record. [called lookup_order#call_1 with {"orderId":"7"}]',
        'tool#call_1 (lookup_order): {"status":"delivered","damaged":true}',
        "assistant: [refused: Cannot delete production logs.]",
        "moderator: Escalated to supervisor.",
      ].join("\n")
    );
  });

  test("renders nested text-only BaseMessages inside plain JSON objects (autoModeMiddleware shape)", () => {
    const state = {
      messages: [
        new HumanMessage("Clean up the build directory."),
        new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "tc_9",
              name: "bash",
              args: { cmd: "rm -rf ./dist" },
              type: "tool_call",
            },
          ],
        }),
      ],
      tool_call: {
        name: "bash",
        args: { cmd: "rm -rf ./dist" },
      },
    };

    const serialized = convertStateToDecisionsInput(state);
    expect(typeof serialized).toBe("string");
    expect(JSON.parse(serialized as string)).toEqual({
      messages: [
        "user: Clean up the build directory.",
        'assistant: [called bash#tc_9 with {"cmd":"rm -rf ./dist"}]',
      ],
      tool_call: {
        name: "bash",
        args: { cmd: "rm -rf ./dist" },
      },
    });
  });

  test("converts root media blocks and root multimodal BaseMessages with newline separators", () => {
    const singleImage = convertStateToDecisionsInput(
      {
        type: "image",
        mimeType: "image/png",
        data: TINY_PNG_BASE64,
      },
      "low"
    );
    expect(singleImage).toEqual([
      {
        type: "image",
        mime_type: "image/png",
        data: TINY_PNG_BASE64,
        resolution: "low",
      },
    ]);

    const msg = new HumanMessage({
      content: [
        { type: "text", text: "Before image 1." },
        { type: "text", text: "Before image 2." },
        {
          type: "image",
          mimeType: "image/png",
          data: TINY_PNG_BASE64,
          metadata: { mediaResolution: "high" },
        },
        { type: "text", text: "After image 1." },
        { type: "text", text: "After image 2." },
      ],
    });
    expect(convertStateToDecisionsInput(msg, "low")).toEqual([
      { type: "text", text: "user: Before image 1.\nBefore image 2.\n" },
      {
        type: "image",
        mime_type: "image/png",
        data: TINY_PNG_BASE64,
        resolution: "high",
      },
      { type: "text", text: "\nAfter image 1.\nAfter image 2." },
    ]);
  });

  test("converts Uint8Array, data URLs, image_url, audio, video (clamping ultra_high), and PDF files", () => {
    const rawBytes = new Uint8Array([1, 2, 3, 4]);
    const expectedB64 = btoa(String.fromCharCode(1, 2, 3, 4));

    const result = convertStateToDecisionsInput(
      [
        "Inspect all attachments:",
        "Second header line.",
        {
          type: "image",
          mimeType: "image/jpeg",
          data: rawBytes as unknown as string,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${TINY_PNG_BASE64}`,
            detail: "low",
          },
        },
        {
          type: "video",
          mimeType: "video/mp4",
          uri: "https://storage.googleapis.com/bucket/clip.mp4",
        },
        {
          type: "audio",
          mimeType: "audio/mp3",
          data: expectedB64,
        },
        {
          type: "file",
          mimeType: "application/pdf",
          uri: "https://storage.googleapis.com/bucket/manual.pdf",
        },
      ],
      "ultra_high"
    );

    expect(result).toEqual([
      {
        type: "text",
        text: "Inspect all attachments:\nSecond header line.",
      },
      {
        type: "image",
        mime_type: "image/jpeg",
        data: expectedB64,
        resolution: "ultra_high",
      },
      {
        type: "image",
        mime_type: "image/png",
        data: TINY_PNG_BASE64,
        resolution: "low",
      },
      {
        type: "video",
        mime_type: "video/mp4",
        uri: "https://storage.googleapis.com/bucket/clip.mp4",
        resolution: "high",
      },
      {
        type: "audio",
        mime_type: "audio/mp3",
        data: expectedB64,
      },
      {
        type: "document",
        mime_type: "application/pdf",
        uri: "https://storage.googleapis.com/bucket/manual.pdf",
      },
    ]);
  });

  test("infers image, audio, video, and document kinds from mimeType on v1 file blocks", () => {
    const result = convertStateToDecisionsInput(
      [
        {
          type: "file",
          mimeType: "image/png",
          data: TINY_PNG_BASE64,
        },
        {
          type: "file",
          mimeType: "video/mp4",
          fileId: "https://generativelanguage.googleapis.com/v1beta/files/vid1",
        },
        {
          type: "file",
          mimeType: "audio/mp3",
          data: TINY_PNG_BASE64,
        },
        {
          type: "file",
          mimeType: "application/pdf",
          url: "https://storage.googleapis.com/bucket/manual.pdf",
        },
      ],
      "ultra_high"
    );

    expect(result).toEqual([
      {
        type: "image",
        mime_type: "image/png",
        data: TINY_PNG_BASE64,
        resolution: "ultra_high",
      },
      {
        type: "video",
        mime_type: "video/mp4",
        uri: "https://generativelanguage.googleapis.com/v1beta/files/vid1",
        resolution: "high",
      },
      {
        type: "audio",
        mime_type: "audio/mp3",
        data: TINY_PNG_BASE64,
      },
      {
        type: "document",
        mime_type: "application/pdf",
        uri: "https://storage.googleapis.com/bucket/manual.pdf",
      },
    ]);
  });

  test("omits mime_type when unavailable rather than throwing or guessing fake defaults, while sniffing known URI extensions", () => {
    const result = convertStateToDecisionsInput([
      {
        type: "video",
        url: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
      },
      {
        type: "image",
        url: "https://cdn.example.com/photo?id=3",
      },
      {
        type: "image",
        fileId: "files/abc123",
      },
      {
        type: "image_url",
        image_url: "https://cdn.example.com/render?asset=99",
      },
      {
        inlineData: {
          data: TINY_PNG_BASE64,
        },
      },
      {
        type: "file",
        url: "https://storage.googleapis.com/bucket/photo.png",
      },
      {
        type: "file",
        url: "https://storage.googleapis.com/bucket/table.csv",
      },
    ]);

    expect(result).toEqual([
      {
        type: "video",
        uri: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
      },
      {
        type: "image",
        uri: "https://cdn.example.com/photo?id=3",
      },
      {
        type: "image",
        uri: "files/abc123",
      },
      {
        type: "image",
        uri: "https://cdn.example.com/render?asset=99",
      },
      {
        type: "document",
        data: TINY_PNG_BASE64,
      },
      {
        type: "image",
        mime_type: "image/png",
        uri: "https://storage.googleapis.com/bucket/photo.png",
      },
      {
        type: "document",
        mime_type: "text/csv",
        uri: "https://storage.googleapis.com/bucket/table.csv",
      },
    ]);
  });

  test("converts root state arrays of multiple text and multimodal ContentBlocks", () => {
    const textBlocksOnly = convertStateToDecisionsInput([
      {
        type: "text",
        text: "First text block.",
        id: "lc-block-1",
        index: 0,
      },
      {
        type: "text-plain",
        text: "Second plain-text block.",
        mimeType: "text/plain",
      },
      {
        type: "file",
        source_type: "text",
        text: "Third legacy text block.",
      },
    ]);
    expect(textBlocksOnly).toBe(
      "First text block.\nSecond plain-text block.\nThird legacy text block."
    );

    const mixedBlocks = convertStateToDecisionsInput(
      [
        { type: "text", text: "Reference photo:" },
        { type: "text", text: "Inspect carefully." },
        {
          type: "image",
          mimeType: "image/png",
          data: TINY_PNG_BASE64,
        },
        { type: "text", text: "Submitted return photo:" },
        {
          type: "image",
          mimeType: "image/png",
          data: TINY_PNG_BASE64,
          metadata: { mediaResolution: "high" },
        },
      ],
      "low"
    );
    expect(mixedBlocks).toEqual([
      {
        type: "text",
        text: "Reference photo:\nInspect carefully.",
      },
      {
        type: "image",
        mime_type: "image/png",
        data: TINY_PNG_BASE64,
        resolution: "low",
      },
      {
        type: "text",
        text: "Submitted return photo:",
      },
      {
        type: "image",
        mime_type: "image/png",
        data: TINY_PNG_BASE64,
        resolution: "high",
      },
    ]);

    // Domain JSON objects that happen to include `type: "text"` alongside
    // domain fields must remain serialized as JSON, not stripped to `.text`.
    const domainObjects = [
      { type: "text", text: "note-1", customer_id: "cust_1" },
      { type: "text", text: "note-2", customer_id: "cust_2" },
    ];
    expect(convertStateToDecisionsInput(domainObjects)).toBe(
      JSON.stringify(domainObjects)
    );
  });

  test("throws InvalidInputError when media blocks appear nested inside a JSON object", () => {
    expect(() =>
      convertStateToDecisionsInput({
        customer: "Ada",
        photo: {
          type: "image",
          mimeType: "image/png",
          data: TINY_PNG_BASE64,
        },
      })
    ).toThrow(InvalidInputError);

    expect(() =>
      convertStateToDecisionsInput({
        messages: [
          new HumanMessage({
            content: [
              {
                type: "image",
                mimeType: "image/png",
                data: TINY_PNG_BASE64,
              },
            ],
          }),
        ],
        tool_call: { name: "noop" },
      })
    ).toThrow(InvalidInputError);
  });
});

describe("convertQuestionsToDecisionsQuestions", () => {
  test("converts noul, choice, and score questions with minimal wire adaptation", () => {
    const questions: Record<string, Question> = {
      is_damaged: {
        type: "noul",
        instructions: "Did the item arrive physically damaged?",
        criteria: {
          true: "Cracked, chipped, or broken on arrival.",
          false: { summary: "Intact or purely cosmetic box wear." },
        },
      },
      bare_noul: {
        type: "noul",
        instructions: "Is the customer requesting a refund?",
      },
      route: {
        type: "choice",
        instructions: {
          task: "Select the support queue.",
          fallback: "general",
        },
        criteria: {
          billing: "Payment, invoice, or refund issues.",
          general: null,
          structured: { sla_hours: 4 },
        },
      },
      severity: {
        type: "score",
        instructions: "Rate the urgency of the issue.",
        criteria: [
          "Low urgency routine inquiry.",
          "Moderate urgency impacting workflow.",
          { level: "critical", page_oncall: true },
        ],
      },
    };

    const wire = convertQuestionsToDecisionsQuestions(questions);
    expect(wire).toEqual({
      is_damaged: {
        type: "noul",
        instructions: "Did the item arrive physically damaged?",
        criteria: {
          true_description: "Cracked, chipped, or broken on arrival.",
          false_description:
            '{"summary":"Intact or purely cosmetic box wear."}',
        },
      },
      bare_noul: {
        type: "noul",
        instructions: "Is the customer requesting a refund?",
      },
      route: {
        type: "choice",
        instructions:
          '{"task":"Select the support queue.","fallback":"general"}',
        criteria: {
          billing: "Payment, invoice, or refund issues.",
          general: "",
          structured: '{"sla_hours":4}',
        },
      },
      severity: {
        type: "score",
        instructions: "Rate the urgency of the issue.",
        criteria: [
          "Low urgency routine inquiry.",
          "Moderate urgency impacting workflow.",
          '{"level":"critical","page_oncall":true}',
        ],
      },
    });
  });

  test("rejects unsupported box questions locally with InvalidInputError", () => {
    expect(() =>
      convertQuestionsToDecisionsQuestions({
        target: {
          type: "box",
          instructions: "Locate the submit button.",
        },
      })
    ).toThrow(InvalidInputError);
  });

  test("converts text blocks in question instructions while rejecting media blocks with InvalidInputError", () => {
    expect(
      convertContentToDecisionsInstructions({
        type: "text",
        text: "Does the item match the return policy?",
      })
    ).toBe("Does the item match the return policy?");

    expect(
      convertContentToDecisionsInstructions([
        "Follow all policy clauses:",
        { type: "text", text: "Clause 1: cracked items qualify." },
      ])
    ).toBe("Follow all policy clauses:\nClause 1: cracked items qualify.");

    // Root media block in instructions
    expect(() =>
      convertContentToDecisionsInstructions({
        type: "image",
        mimeType: "image/png",
        data: TINY_PNG_BASE64,
      })
    ).toThrow(InvalidInputError);

    // Media block in instructions array
    expect(() =>
      convertContentToDecisionsInstructions([
        "Does the input match this reference icon?",
        {
          type: "image",
          mimeType: "image/png",
          data: TINY_PNG_BASE64,
        },
      ])
    ).toThrow(InvalidInputError);

    // Media block nested inside JSON instructions
    expect(() =>
      convertContentToDecisionsInstructions({
        prompt: "Compare against reference:",
        reference: {
          type: "image",
          mimeType: "image/png",
          data: TINY_PNG_BASE64,
        },
      })
    ).toThrow(InvalidInputError);
  });

  test("preserves own __proto__ question and option keys across JSON serialization", () => {
    const criteria: Record<string, string> = {};
    Object.defineProperty(criteria, "__proto__", {
      value: "Prototype key description.",
      enumerable: true,
      configurable: true,
      writable: true,
    });
    criteria.normal = "Normal option description.";

    const questions: Record<string, Question> = {};
    Object.defineProperty(questions, "__proto__", {
      value: {
        type: "choice",
        instructions: "Pick the matching key.",
        criteria,
      },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const wire = convertQuestionsToDecisionsQuestions(questions);
    expect(Object.hasOwn(wire, "__proto__")).toBe(true);
    const serialized = JSON.stringify(wire);
    expect(serialized).toContain('"__proto__"');
  });
});

describe("convertDecisionsResponseToClassifierResponse & safety error helpers", () => {
  test("strips extra noul confidence, restores JsonValue score legends, and maps usage metadata", () => {
    const questions: Record<string, Question> = {
      is_damaged: {
        type: "noul",
        instructions: "Did the item arrive damaged?",
      },
      department: {
        type: "choice",
        instructions: "Which team owns this ticket?",
        criteria: {
          shipping: "Carrier or delivery damage.",
          billing: "Charge or invoice issue.",
        },
      },
      urgency: {
        type: "score",
        instructions: "Rate the urgency.",
        criteria: [
          "Low priority.",
          { tier: 1, label: "Immediate replacement" },
        ],
      },
    };

    const result = convertDecisionsResponseToClassifierResponse({
      model: "gemini-decision-1",
      questions,
      requestId: "req_abc123",
      data: {
        answers: {
          is_damaged: {
            type: "noul",
            noul: 0.96,
            confidence: 0.96,
          },
          department: {
            type: "choice",
            choice: "shipping",
            probabilities: { shipping: 0.92, billing: 0.08 },
            confidence: 0.92,
          },
          urgency: {
            type: "score",
            score: 1,
            legend: {
              "0": "Low priority.",
              "1": '{"tier":1,"label":"Immediate replacement"}',
            },
            probabilities: { "0": 0.1, "1": 0.9 },
            confidence: 0.9,
          },
        },
        usage: {
          total_input_tokens: 120,
          total_tokens: 120,
          input_tokens_by_modality: [
            { modality: "text", tokens: 40 },
            { modality: "image", tokens: 80 },
          ],
        },
      },
    });

    expect(result.model).toBe("gemini-decision-1");
    expect(result.requestId).toBe("req_abc123");
    expect(result.nouls.is_damaged).toEqual({
      type: "noul",
      noul: 0.96,
    });
    expect("confidence" in result.nouls.is_damaged).toBe(false);
    expect(result.choices.department).toEqual({
      type: "choice",
      choice: "shipping",
      probabilities: { shipping: 0.92, billing: 0.08 },
      confidence: 0.92,
    });
    expect(result.scores.urgency).toEqual({
      type: "score",
      score: 1,
      legend: {
        "0": "Low priority.",
        "1": { tier: 1, label: "Immediate replacement" },
      },
      probabilities: { "0": 0.1, "1": 0.9 },
      confidence: 0.9,
    });
    expect(result.usage_metadata).toEqual({
      input_tokens: 120,
      output_tokens: 0,
      total_tokens: 120,
      input_token_details: {
        text: 40,
        image: 80,
      },
    });
  });

  test("maps prompt_feedback.block_reason to PromptRefusedError / PromptBlockedError", () => {
    try {
      convertDecisionsResponseToClassifierResponse({
        model: "gemini-decision-1",
        questions: {},
        data: {
          prompt_feedback: {
            block_reason: "SAFETY",
            block_reason_message: "Blocked by safety policy.",
          },
        },
      });
      expect.unreachable("Expected PromptRefusedError");
    } catch (error) {
      expect(PromptRefusedError.isInstance(error)).toBe(true);
      expect(PromptBlockedError.isInstance(error)).toBe(true);
      expect(ModelRefusalError.isInstance(error)).toBe(true);
      expect((error as PromptBlockedError).blockReason).toBe("SAFETY");
      expect((error as Error).message).toBe("Blocked by safety policy.");
    }

    try {
      convertDecisionsResponseToClassifierResponse({
        model: "gemini-decision-1",
        questions: {},
        data: {
          prompt_feedback: {
            block_reason: "BLOCK_REASON_UNSPECIFIED",
          },
        },
      });
      expect.unreachable("Expected PromptBlockedError");
    } catch (error) {
      expect(PromptBlockedError.isInstance(error)).toBe(true);
      expect(PromptRefusedError.isInstance(error)).toBe(false);
      expect(ModelRefusalError.isInstance(error)).toBe(false);
    }
  });

  test("maps HTTP 400 safety error codes to PromptRefusedError", () => {
    const refused = decisionBlockedErrorFromErrorBody({
      error: {
        code: "prohibited_content",
        message: "Input violates prohibited content policy.",
      },
    });
    expect(refused).toBeDefined();
    expect(PromptRefusedError.isInstance(refused)).toBe(true);
    expect(ModelRefusalError.isInstance(refused)).toBe(true);
    expect(refused?.blockReason).toBe("prohibited_content");

    expect(
      decisionBlockedErrorFromErrorBody({
        error: {
          code: "invalid_argument",
          message: "Choice question may have at most 20 options.",
        },
      })
    ).toBeUndefined();
  });

  test("throws MalformedOutputError when answers are missing or malformed", () => {
    expect(() =>
      convertDecisionsResponseToClassifierResponse({
        model: "gemini-decision-1",
        questions: {},
        data: {},
      })
    ).toThrow(MalformedOutputError);

    expect(() =>
      convertDecisionsResponseToClassifierResponse({
        model: "gemini-decision-1",
        questions: {},
        data: {
          answers: {
            bad_noul: {
              type: "noul",
              noul: 2.5,
            },
          },
        },
      })
    ).toThrow(MalformedOutputError);
  });
});
