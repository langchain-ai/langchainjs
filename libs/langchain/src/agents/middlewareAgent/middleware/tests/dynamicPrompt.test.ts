/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { describe, it, expect, vi } from "vitest";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { dynamicPromptMiddleware } from "../dynamicPrompt.js";
import { createAgent } from "../../index.js";

function createMockModel() {
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  return {
    getName: () => "mock",
    bindTools: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: "mock",
    _generate: vi.fn(),
    _llmType: () => "mock",
  };
}

describe("dynamicPromptMiddleware", () => {
  it("should set system message from dynamic prompt before model call", async () => {
    const mockModel = createMockModel();
    const contextSchema = z.object({ region: z.string().optional() });

    const middleware = dynamicPromptMiddleware<z.infer<typeof contextSchema>>(
      (_state, runtime) => {
        const region = runtime.context.region ?? "n/a";
        return new SystemMessage(
          `You are a helpful assistant. Region: ${region}`
        );
      }
    );

    const agent = createAgent({
      llm: mockModel as any,
      middleware: [middleware] as const,
      contextSchema,
    });

    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke(
      { messages },
      {
        context: {
          region: "EU",
        },
      }
    );

    expect(mockModel.invoke).toHaveBeenCalled();
    const callArgs = (mockModel.invoke as any).mock.calls[0];
    const [firstMessage] = callArgs[0];
    expect(firstMessage.type).toBe("system");
    expect(firstMessage.content).toBe(
      "You are a helpful assistant. Region: EU"
    );
  });

  it("should allow to return a string", async () => {
    const mockModel = createMockModel();
    const contextSchema = z.object({ region: z.string().optional() });

    const middleware = dynamicPromptMiddleware<z.infer<typeof contextSchema>>(
      (_state, runtime) => {
        const region = runtime.context.region ?? "n/a";
        return `You are a helpful assistant. Region: ${region}`;
      }
    );

    const agent = createAgent({
      llm: mockModel as any,
      middleware: [middleware] as const,
      contextSchema,
    });

    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke(
      { messages },
      {
        context: {
          region: "EU",
        },
      }
    );

    expect(mockModel.invoke).toHaveBeenCalled();
    const callArgs = (mockModel.invoke as any).mock.calls[0];
    const [firstMessage] = callArgs[0];
    expect(firstMessage.type).toBe("system");
    expect(firstMessage.content).toBe(
      "You are a helpful assistant. Region: EU"
    );
  });
});
