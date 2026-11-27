import { describe, expect, test } from "vitest";
import { FunctionCallingMode } from "@google/generative-ai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { convertToolsToGenAI } from "../utils/tools.js";

const weather = tool(async ({ city }) => `Sunny in ${city}`, {
  name: "get_weather",
  description: "Get the weather",
  schema: z.object({ city: z.string() }),
});

describe("convertToolsToGenAI tool config", () => {
  test("maps the OpenAI-style required tool choice to ANY without allowed names", () => {
    const { toolConfig } = convertToolsToGenAI([weather], {
      toolChoice: "required",
    });

    expect(toolConfig).toEqual({
      functionCallingConfig: { mode: FunctionCallingMode.ANY },
    });
  });

  test("keeps the any mode", () => {
    const { toolConfig } = convertToolsToGenAI([weather], {
      toolChoice: "any",
    });

    expect(toolConfig).toEqual({
      functionCallingConfig: { mode: FunctionCallingMode.ANY },
    });
  });

  test("keeps a function name as the only allowed function", () => {
    const { toolConfig } = convertToolsToGenAI([weather], {
      toolChoice: "get_weather",
    });

    expect(toolConfig).toEqual({
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: ["get_weather"],
      },
    });
  });
});
