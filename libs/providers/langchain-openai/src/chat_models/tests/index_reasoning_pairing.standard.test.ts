/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, describe, beforeAll } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "../index.js";
import { ChatOpenAIResponses } from "../responses.js";

class CapturingResponses extends ChatOpenAIResponses {
  public capturedInputs: unknown[] = [];

  // Override to capture the request and return a minimal valid response

  override async completionWithRetry(request: any): Promise<any> {
    this.capturedInputs.push(request.input);

    const now = Math.floor(Date.now() / 1000);
    return {
      id: "resp_test",
      created_at: now,
      model: this.model,
      object: "response",
      status: "completed",
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      output_text: "ok",
      output: [
        {
          type: "message",
          role: "assistant",
          id: "msg_test",
          content: [{ type: "output_text", text: "ok", annotations: [] }],
        },
      ],
    };
  }
}

beforeAll(() => {
  // Ensure constructor passes API key validation in tests
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test";
});

describe("Responses API reasoning pairing", () => {
  test("includes function_call id when !zdrEnabled so reasoning can pair", async () => {
    const responses = new CapturingResponses({
      model: "gpt-5",
    });
    const llm = new ChatOpenAI({
      model: "gpt-5",
      useResponsesApi: true,
      responses,
    });

    const mappingKey = "__openai_function_call_ids__";

    const aiWithToolCall = new AIMessage({
      content: [],
      tool_calls: [
        {
          name: "multiply",
          id: "call_abc",
          args: { x: 2, y: 3 },
          type: "tool_call",
        },
      ],
      additional_kwargs: {
        [mappingKey]: { call_abc: "fc_123" },
        reasoning: {
          id: "rs_123",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "short summary", index: 0 }],
        },
      },
    });

    const toolResult = new ToolMessage({
      tool_call_id: "call_abc",
      content: "6",
    });

    await llm.invoke([new HumanMessage("hi"), aiWithToolCall, toolResult]);

    // Assert we constructed input with function_call id and reasoning item
    const inputs = responses.capturedInputs[0] as Array<
      Record<string, unknown>
    >;
    expect(Array.isArray(inputs)).toBe(true);

    const reasoning = inputs.find(
      (i) => i && (i as any).type === "reasoning"
    ) as any;
    const fnCall = inputs.find(
      (i) => i && (i as any).type === "function_call"
    ) as any;

    expect(reasoning).toBeDefined();
    expect(reasoning.id).toBe("rs_123");

    expect(fnCall).toBeDefined();
    expect(fnCall.call_id).toBe("call_abc");
    expect(fnCall.id).toBe("fc_123");
  });

  test("does not include function_call id when zdrEnabled=true (and reasoning omitted)", async () => {
    const responses = new CapturingResponses({
      model: "gpt-5",
      zdrEnabled: true,
    });
    const llm = new ChatOpenAI({
      model: "gpt-5",
      useResponsesApi: true,
      responses,
    });

    const mappingKey = "__openai_function_call_ids__";

    const aiWithToolCall = new AIMessage({
      content: [],
      tool_calls: [
        {
          name: "multiply",
          id: "call_def",
          args: { x: 2, y: 4 },
          type: "tool_call",
        },
      ],
      additional_kwargs: {
        [mappingKey]: { call_def: "fc_456" },
        reasoning: {
          id: "rs_456",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "short summary", index: 0 }],
        },
      },
    });

    const toolResult = new ToolMessage({
      tool_call_id: "call_def",
      content: "8",
    });

    await llm.invoke([new HumanMessage("hi"), aiWithToolCall, toolResult]);

    const inputs = responses.capturedInputs[0] as Array<
      Record<string, unknown>
    >;
    expect(Array.isArray(inputs)).toBe(true);

    const reasoning = inputs.find(
      (i) => i && (i as any).type === "reasoning"
    ) as any;
    const fnCall = inputs.find(
      (i) => i && (i as any).type === "function_call"
    ) as any;

    // With ZDR enabled, we omit reasoning; function_call id should also be omitted per gating
    expect(reasoning).toBeUndefined();
    expect(fnCall).toBeDefined();
    expect(fnCall.call_id).toBe("call_def");
    expect(fnCall.id).toBeUndefined();
  });

  test("errors when orphan reasoning is sent without following item", async () => {
    const responses = new CapturingResponses({
      model: "gpt-5",
    });

    // Force an error from the underlying client to simulate API validation

    (responses.completionWithRetry as any) = async (request: any) => {
      // Validate our constructed input contains a reasoning item without any following assistant message/function/tool
      const inputs = request.input as Array<Record<string, unknown>>;
      const rIndex = inputs.findIndex(
        (i) => i && (i as any).type === "reasoning"
      );
      expect(rIndex).toBeGreaterThan(-1);
      const nextItem = inputs[rIndex + 1] as any;
      // Orphan reasoning: there must be no immediately following assistant message/function/tool
      expect(nextItem).toBeUndefined();
      const error: any = new Error(
        "BadRequestError: 400 Item 'rs_x' of type 'reasoning' was provided without its required following item."
      );
      error.status = 400;
      throw error;
    };

    const llm = new ChatOpenAI({
      model: "gpt-5",
      useResponsesApi: true,
      responses,
    });

    // Assistant message having only reasoning in additional_kwargs and no content, no tool calls
    const aiOnlyReasoning = new AIMessage({
      content: [],
      additional_kwargs: {
        reasoning: {
          id: "rs_orphan",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "orphan", index: 0 }],
        },
      },
    });

    await expect(
      llm.invoke([new HumanMessage("hi"), aiOnlyReasoning])
    ).rejects.toThrow(/reasoning.*required following item/i);
  });
});
