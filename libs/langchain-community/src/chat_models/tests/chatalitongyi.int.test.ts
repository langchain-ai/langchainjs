import { describe, expect, jest, test } from "@jest/globals";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { ChatAlibabaTongyi } from "../alibaba_tongyi.js";

const apiKey = process.env.ALIBABA_API_KEY;
const runIfApiKey = apiKey ? test : test.skip;
const region =
  (process.env.ALIBABA_REGION as "china" | "singapore" | "us") ?? "singapore";

const calculatorTool = {
  type: "function" as const,
  function: {
    name: "calculator",
    description: "Perform basic arithmetic operations.",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "multiply"],
        },
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["operation", "a", "b"],
    },
  },
};

function executeCalculator(args: Record<string, unknown>): number {
  const operation = typeof args.operation === "string" ? args.operation : "add";
  const a = typeof args.a === "number" ? args.a : Number(args.a);
  const b = typeof args.b === "number" ? args.b : Number(args.b);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error("Invalid calculator arguments");
  }
  if (operation === "multiply") {
    return a * b;
  }
  return a + b;
}

function asText(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

describe("ChatAlibabaTongyi integration", () => {
  jest.setTimeout(180000);

  runIfApiKey("invokes in non-streaming mode without tools", async () => {
    const model = new ChatAlibabaTongyi({
      alibabaApiKey: apiKey,
      region,
      model: "qwen-turbo",
      temperature: 0,
    });

    const response = await model.invoke("Reply with a short greeting.");
    expect(typeof asText(response.content)).toBe("string");
    expect(asText(response.content).length).toBeGreaterThan(0);
  });

  runIfApiKey("streams in non-tool mode", async () => {
    const model = new ChatAlibabaTongyi({
      alibabaApiKey: apiKey,
      region,
      model: "qwen-turbo",
      temperature: 0,
    });

    const stream = await model.stream("Say hello in one short sentence.");
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(
      chunks.some((chunk) => (chunk.tool_call_chunks?.length ?? 0) > 0)
    ).toBe(false);
  });

  runIfApiKey(
    "tool calling via invoke returns calculator tool call",
    async () => {
      const model = new ChatAlibabaTongyi({
        alibabaApiKey: apiKey,
        region,
        model: "qwen-plus",
        temperature: 0,
      }).bindTools([calculatorTool], {
        tool_choice: {
          type: "function",
          function: { name: "calculator" },
        },
      });

      const response = await model.invoke(
        "Use calculator to multiply 6 by 12."
      );
      expect(response.tool_calls?.length ?? 0).toBeGreaterThan(0);
      expect(response.tool_calls?.[0]?.name).toBe("calculator");
      if (response.response_metadata?.finish_reason) {
        expect(["tool_calls", "stop"]).toContain(
          response.response_metadata.finish_reason
        );
      }
    }
  );

  runIfApiKey("tool calling via stream yields tool call chunks", async () => {
    const model = new ChatAlibabaTongyi({
      alibabaApiKey: apiKey,
      region,
      model: "qwen-plus",
      temperature: 0,
    }).bindTools([calculatorTool], {
      tool_choice: {
        type: "function",
        function: { name: "calculator" },
      },
    });

    const stream = await model.stream("Use calculator to add 9 and 11.");
    let hasToolCallChunks = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aggregated: any;
    for await (const chunk of stream) {
      if ((chunk.tool_call_chunks?.length ?? 0) > 0) {
        hasToolCallChunks = true;
      }
      aggregated = aggregated ? aggregated.concat(chunk) : chunk;
    }

    expect(hasToolCallChunks).toBe(true);
    const hasCalculatorParsed =
      aggregated?.tool_calls?.some(
        (toolCall: { name?: string }) => toolCall.name === "calculator"
      ) ?? false;
    const hasCalculatorInvalid =
      aggregated?.invalid_tool_calls?.some(
        (toolCall: { name?: string }) => toolCall.name === "calculator"
      ) ?? false;
    expect(hasCalculatorParsed || hasCalculatorInvalid).toBe(true);
  });

  runIfApiKey("multi-turn tool loop with ToolMessage", async () => {
    const model = new ChatAlibabaTongyi({
      alibabaApiKey: apiKey,
      region,
      model: "qwen-plus",
      temperature: 0,
    }).bindTools([calculatorTool], {
      tool_choice: {
        type: "function",
        function: { name: "calculator" },
      },
    });

    const first = await model.invoke("Use calculator to multiply 6 by 12.");
    const firstToolCall = first.tool_calls?.[0];
    expect(firstToolCall).toBeDefined();
    if (!firstToolCall) {
      return;
    }

    const result = executeCalculator(
      firstToolCall.args as Record<string, unknown>
    );
    const followup = await model.invoke(
      [
        new HumanMessage("Use calculator to multiply 6 by 12."),
        first,
        new ToolMessage({
          tool_call_id: firstToolCall.id ?? "calculator_call_1",
          content: JSON.stringify({ result }),
        }),
        new HumanMessage('Use the tool result and answer with exactly "72".'),
      ],
      {
        tool_choice: "none",
      }
    );

    const followupText = asText(followup.content);
    expect(followupText.length).toBeGreaterThan(0);
    expect(followupText).toMatch(/72|seventy[- ]two/i);
  });

  runIfApiKey(
    "tool_choice compatibility fallback with any does not fail",
    async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const model = new ChatAlibabaTongyi({
          alibabaApiKey: apiKey,
          region,
          model: "qwen-turbo",
          temperature: 0,
        }).bindTools([calculatorTool], {
          tool_choice: "any",
        });

        const response = await model.invoke("What is 2 + 2?");
        expect(typeof asText(response.content)).toBe("string");
      } finally {
        warnSpy.mockRestore();
      }
    }
  );

  runIfApiKey("withStructuredOutput returns parsed object", async () => {
    const schema = z.object({
      location: z.string(),
      unit: z.string(),
    });

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: apiKey,
      region,
      model: "qwen-plus",
      temperature: 0,
    }).withStructuredOutput(schema, { name: "extract_weather" });

    const response = await model.invoke(
      "Extract structured fields from this sentence: location is Warsaw and unit is celsius."
    );
    expect(response.location.toLowerCase()).toContain("warsaw");
    expect(response.unit.toLowerCase()).toContain("celsius");
  });

  runIfApiKey(
    "withStructuredOutput includeRaw returns raw and parsed",
    async () => {
      const schema = z.object({
        location: z.string(),
        unit: z.string(),
      });

      const model = new ChatAlibabaTongyi({
        alibabaApiKey: apiKey,
        region,
        model: "qwen-plus",
        temperature: 0,
      }).withStructuredOutput(schema, {
        name: "extract_weather",
        includeRaw: true,
      });

      const response = await model.invoke(
        "Extract structured fields from this sentence: location is Tokyo and unit is celsius."
      );
      expect(response.raw).toBeDefined();
      expect(response.parsed).toBeDefined();
      if (response.parsed) {
        expect(response.parsed.location.toLowerCase()).toContain("tokyo");
      }
    }
  );

  runIfApiKey(
    "withStructuredOutput no-tool-call contract is stable (throw or null parsed)",
    async () => {
      const schema = z.object({
        location: z.string(),
      });

      const model = new ChatAlibabaTongyi({
        alibabaApiKey: apiKey,
        region,
        model: "qwen-plus",
        temperature: 0,
      }).withStructuredOutput(schema, {
        name: "extract_weather",
        includeRaw: true,
      });

      try {
        const response = await model.invoke(
          "Reply with exactly HELLO and no additional formatting."
        );
        // includeRaw path should either parse to object or safely fall back to null.
        expect(response.raw).toBeDefined();
        if (response.parsed !== null) {
          expect(typeof response.parsed).toBe("object");
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "No tool calls found in the response."
        );
      }
    }
  );
});
