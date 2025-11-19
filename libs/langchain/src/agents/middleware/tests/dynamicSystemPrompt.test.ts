/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { describe, it, expect, vi } from "vitest";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { dynamicSystemPromptMiddleware } from "../dynamicSystemPrompt.js";
import { createAgent } from "../../index.js";

function createMockModel() {
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  return {
    getName: () => "mock",
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: "mock",
    _generate: vi.fn(),
    _llmType: () => "mock",
  };
}

describe("dynamicSystemPrompt", () => {
  it("should set system message from dynamic prompt before model call", async () => {
    const model = createMockModel() as unknown as LanguageModelLike;
    const contextSchema = z.object({ region: z.string().optional() });

    const middleware = dynamicSystemPromptMiddleware<
      z.infer<typeof contextSchema>
    >((_state, runtime) => {
      const region = runtime.context.region ?? "n/a";
      return `You are a helpful assistant. Region: ${region}`;
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
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

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as any).mock.calls[0];
    const [firstMessage] = callArgs[0];
    expect(firstMessage.type).toBe("system");
    expect(firstMessage.content).toBe(
      "You are a helpful assistant. Region: EU"
    );
  });

  it("should support returning a SystemMessage", async () => {
    const model = createMockModel() as unknown as LanguageModelLike;
    const contextSchema = z.object({ region: z.string().optional() });

    const middleware = dynamicSystemPromptMiddleware<
      z.infer<typeof contextSchema>
    >((_state, runtime) => {
      const region = runtime.context.region ?? "n/a";
      return new SystemMessage(
        `You are a helpful assistant. Region: ${region}`
      );
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
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

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as any).mock.calls[0];
    const [firstMessage] = callArgs[0];
    expect(firstMessage.type).toBe("system");
    expect(firstMessage.content).toBe(
      "You are a helpful assistant. Region: EU"
    );
  });

  it("should throw if the function does not return an expected type", async () => {
    const model = createMockModel() as unknown as LanguageModelLike;
    const contextSchema = z.object({ region: z.string().optional() });

    const middleware = dynamicSystemPromptMiddleware<
      z.infer<typeof contextSchema>
      // @ts-expect-error - we want to test the error case
    >((_state, runtime) => 123);

    const agent = createAgent({
      model,
      middleware: [middleware],
      contextSchema,
    });

    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await expect(
      agent.invoke(
        { messages },
        {
          context: {
            region: "EU",
          },
        }
      )
    ).rejects.toThrow(
      "dynamicSystemPromptMiddleware function must return a string or SystemMessage"
    );
  });
});
