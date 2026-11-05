import { describe, expect, it } from "vitest";
import { z } from "zod/v3";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ModelRefusalError } from "@langchain/core/errors";
import { fakeModel } from "@langchain/core/testing";

import { createAgent } from "../../index.js";
import { providerStrategy, toolStrategy } from "../../responses.js";
import { modelFallbackMiddleware } from "../modelFallback.js";
import { modelRefusalMiddleware } from "../modelRefusal.js";
import { modelRetryMiddleware } from "../modelRetry.js";

const refusal = () =>
  new AIMessage({
    content: [],
    response_metadata: {
      model_provider: "anthropic",
      stop_reason: "refusal",
      stop_details: { category: "cyber", explanation: "Blocked." },
    },
  });
const ask = { messages: [new HumanMessage("Scan this code")] };

describe("modelRefusalMiddleware", () => {
  it("throws ModelRefusalError when the model refuses", async () => {
    const refused = refusal();
    const agent = createAgent({
      model: fakeModel().respond(refused),
      tools: [],
      middleware: [modelRefusalMiddleware()],
    });
    const error = await agent.invoke(ask).catch((e: unknown) => e);
    expect(ModelRefusalError.isInstance(error)).toBe(true);
    expect((error as ModelRefusalError).message).toBe(
      "Model refused to produce the requested output (category='cyber'): Blocked."
    );
    expect((error as ModelRefusalError).rawMessage?.response_metadata).toEqual(
      refused.response_metadata
    );
  });

  it("passes normal responses through", async () => {
    const agent = createAgent({
      model: fakeModel().respond(new AIMessage("4")),
      tools: [],
      middleware: [modelRefusalMiddleware()],
    });
    const result = await agent.invoke(ask);
    expect(result.messages.at(-1)?.content).toBe("4");
  });

  it("lets a fallback model answer after a refusal", async () => {
    const agent = createAgent({
      model: fakeModel().respond(refusal()),
      tools: [],
      middleware: [
        modelFallbackMiddleware(fakeModel().respond(new AIMessage("4"))),
        modelRefusalMiddleware(),
      ],
    });
    const result = await agent.invoke(ask);
    expect(result.messages.at(-1)?.content).toBe("4");
  });

  it("is not retried by modelRetryMiddleware", async () => {
    const model = fakeModel().respond(refusal()).respond(new AIMessage("4"));
    const agent = createAgent({
      model,
      tools: [],
      middleware: [
        modelRetryMiddleware({ initialDelayMs: 0, onFailure: "error" }),
        modelRefusalMiddleware(),
      ],
    });
    await expect(agent.invoke(ask)).rejects.toThrow(ModelRefusalError);
  });

  it("throws on a refusal under providerStrategy", async () => {
    const agent = createAgent({
      model: fakeModel().respond(refusal()),
      tools: [],
      responseFormat: providerStrategy(z.object({ summary: z.string() })),
      middleware: [modelRefusalMiddleware()],
    });
    await expect(agent.invoke(ask)).rejects.toThrow(ModelRefusalError);
  });

  it("throws on a refusal under toolStrategy", async () => {
    const agent = createAgent({
      model: fakeModel().respond(refusal()),
      tools: [],
      responseFormat: toolStrategy(z.object({ summary: z.string() })),
      middleware: [modelRefusalMiddleware()],
    });
    await expect(agent.invoke(ask)).rejects.toThrow(ModelRefusalError);
  });

  it("keeps the parse error when a providerStrategy failure is not a refusal", async () => {
    const agent = createAgent({
      model: fakeModel().respond(new AIMessage("not json")),
      tools: [],
      responseFormat: providerStrategy(z.object({ summary: z.string() })),
      middleware: [modelRefusalMiddleware()],
    });
    await expect(agent.invoke(ask)).rejects.toThrow(
      /did not satisfy the provided response schema/
    );
  });
});
