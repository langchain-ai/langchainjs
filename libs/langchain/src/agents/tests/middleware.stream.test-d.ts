import { describe, it, expectTypeOf } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { StreamChannel, type StreamTransformer } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";
import type { InferMiddlewareType } from "../middleware/types.js";
import type {
  InferAgentStreamTransformers,
  InferMiddlewareStreamTransformers,
} from "../types.js";

describe("middleware streamTransformers types", () => {
  it("should infer stream transformers on createMiddleware", () => {
    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => ({
      init: () => ({ eventCount: StreamChannel.remote<number>("eventCount") }),
      process() {
        return true;
      },
    });

    const middleware = createMiddleware({
      name: "StreamMiddleware",
      streamTransformers: [eventCounter],
    });

    expectTypeOf<
      InferMiddlewareType<typeof middleware, "StreamTransformers">
    >().toEqualTypeOf<readonly [typeof eventCounter]>();

    expectTypeOf<
      InferMiddlewareStreamTransformers<typeof middleware>
    >().toEqualTypeOf<readonly [typeof eventCounter]>();
  });

  it("should infer combined stream transformers on createAgent", () => {
    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => ({
      init: () => ({ eventCount: StreamChannel.remote<number>("eventCount") }),
      process() {
        return true;
      },
    });

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => ({
      init: () => ({ methods: StreamChannel.remote<string>("methods") }),
      process() {
        return true;
      },
    });

    const middleware = createMiddleware({
      name: "StreamMiddleware",
      streamTransformers: [eventCounter],
    });

    const agent = createAgent({
      model: "gpt-4",
      tools: [],
      middleware: [middleware],
      streamTransformers: [methodTracker],
    });

    expectTypeOf<InferAgentStreamTransformers<typeof agent>[0]>().toEqualTypeOf<
      typeof methodTracker
    >();
    expectTypeOf<InferAgentStreamTransformers<typeof agent>[1]>().toEqualTypeOf<
      typeof eventCounter
    >();
  });

  it("should infer stream transformers from multiple middleware on createAgent", () => {
    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => ({
      init: () => ({ eventCount: StreamChannel.remote<number>("eventCount") }),
      process() {
        return true;
      },
    });

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => ({
      init: () => ({ methods: StreamChannel.remote<string>("methods") }),
      process() {
        return true;
      },
    });

    const counterMiddleware = createMiddleware({
      name: "CounterMiddleware",
      streamTransformers: [eventCounter],
    });

    const trackerMiddleware = createMiddleware({
      name: "TrackerMiddleware",
      streamTransformers: [methodTracker],
    });

    const agent = createAgent({
      model: "gpt-4",
      tools: [],
      middleware: [counterMiddleware, trackerMiddleware],
    });

    expectTypeOf<InferAgentStreamTransformers<typeof agent>[0]>().toEqualTypeOf<
      typeof eventCounter
    >();
    expectTypeOf<InferAgentStreamTransformers<typeof agent>[1]>().toEqualTypeOf<
      typeof methodTracker
    >();
  });

  it("should type run.extensions from middleware-only streamTransformers", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => ({
      init: () => ({ eventCount: StreamChannel.remote<number>("eventCount") }),
      process() {
        return true;
      },
    });

    const middleware = createMiddleware({
      name: "StreamMiddleware",
      streamTransformers: [eventCounter],
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware],
    });

    const run = await agent.streamEvents(
      { messages: [new HumanMessage("hi")] },
      { version: "v3" }
    );

    expectTypeOf(run.extensions.eventCount).toEqualTypeOf<
      StreamChannel<number>
    >();
  });

  it("should type run.extensions from agent and middleware streamTransformers", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => ({
      init: () => ({ eventCount: StreamChannel.remote<number>("eventCount") }),
      process() {
        return true;
      },
    });

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => ({
      init: () => ({ methods: StreamChannel.remote<string>("methods") }),
      process() {
        return true;
      },
    });

    const middleware = createMiddleware({
      name: "StreamMiddleware",
      streamTransformers: [methodTracker],
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware],
      streamTransformers: [eventCounter],
    });

    const run = await agent.streamEvents(
      { messages: [new HumanMessage("hi")] },
      { version: "v3" }
    );

    expectTypeOf(run.extensions.eventCount).toEqualTypeOf<
      StreamChannel<number>
    >();
    expectTypeOf(run.extensions.methods).toEqualTypeOf<StreamChannel<string>>();
  });

  it("should type run.extensions from multiple middleware streamTransformers", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => ({
      init: () => ({ eventCount: StreamChannel.remote<number>("eventCount") }),
      process() {
        return true;
      },
    });

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => ({
      init: () => ({ methods: StreamChannel.remote<string>("methods") }),
      process() {
        return true;
      },
    });

    const counterMiddleware = createMiddleware({
      name: "CounterMiddleware",
      streamTransformers: [eventCounter],
    });

    const trackerMiddleware = createMiddleware({
      name: "TrackerMiddleware",
      streamTransformers: [methodTracker],
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [counterMiddleware, trackerMiddleware],
    });

    const run = await agent.streamEvents(
      { messages: [new HumanMessage("hi")] },
      { version: "v3" }
    );

    expectTypeOf(run.extensions.eventCount).toEqualTypeOf<
      StreamChannel<number>
    >();
    expectTypeOf(run.extensions.methods).toEqualTypeOf<StreamChannel<string>>();
  });
});
