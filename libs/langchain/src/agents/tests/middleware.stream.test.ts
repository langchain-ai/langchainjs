import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { StreamChannel, type StreamTransformer } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";

describe("middleware streamTransformers", () => {
  it("should expose streamTransformers on the middleware instance", () => {
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

    expect(middleware.streamTransformers).toEqual([eventCounter]);
  });

  it("should stream event counts from a middleware-registered transformer", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => {
      const eventCount = StreamChannel.remote<number>("eventCount");
      let count = 0;

      return {
        init: () => ({ eventCount }),
        process() {
          count += 1;
          eventCount.push(count);
          return true;
        },
      };
    };

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

    const counts: number[] = [];
    for await (const c of run.extensions.eventCount as AsyncIterable<number>) {
      counts.push(c);
    }

    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((c, i) => c === i + 1)).toBe(true);
    expect(counts[counts.length - 1]).toBe(counts.length);
  });

  it("should stream protocol methods from a middleware-registered transformer", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => {
      const methods = StreamChannel.remote<string>("methods");
      return {
        init: () => ({ methods }),
        process(event) {
          methods.push(event.method);
          return true;
        },
      };
    };

    const middleware = createMiddleware({
      name: "MethodMiddleware",
      streamTransformers: [methodTracker],
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

    const seenMethods: string[] = [];
    for await (const m of run.extensions.methods as AsyncIterable<string>) {
      seenMethods.push(m);
    }

    expect(seenMethods.length).toBeGreaterThan(0);
    expect(seenMethods).toContain("values");
  });

  it("should merge agent and middleware stream transformers", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => {
      const eventCount = StreamChannel.remote<number>("eventCount");
      let count = 0;
      return {
        init: () => ({ eventCount }),
        process() {
          count += 1;
          eventCount.push(count);
          return true;
        },
      };
    };

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => {
      const methods = StreamChannel.remote<string>("methods");
      return {
        init: () => ({ methods }),
        process(event) {
          methods.push(event.method);
          return true;
        },
      };
    };

    const middleware = createMiddleware({
      name: "MethodMiddleware",
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

    const counts: number[] = [];
    for await (const c of run.extensions.eventCount as AsyncIterable<number>) {
      counts.push(c);
    }

    const seenMethods: string[] = [];
    for await (const m of run.extensions.methods as AsyncIterable<string>) {
      seenMethods.push(m);
    }

    expect(counts.length).toBeGreaterThan(0);
    expect(seenMethods.length).toBeGreaterThan(0);
    expect(seenMethods).toContain("values");
  });

  it("should merge stream transformers from multiple middleware instances", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => {
      const eventCount = StreamChannel.remote<number>("eventCount");
      return {
        init: () => ({ eventCount }),
        process() {
          eventCount.push(1);
          return true;
        },
      };
    };

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => {
      const methods = StreamChannel.remote<string>("methods");
      return {
        init: () => ({ methods }),
        process(event) {
          methods.push(event.method);
          return true;
        },
      };
    };

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

    const counts: number[] = [];
    for await (const c of run.extensions.eventCount as AsyncIterable<number>) {
      counts.push(c);
    }

    const seenMethods: string[] = [];
    for await (const m of run.extensions.methods as AsyncIterable<string>) {
      seenMethods.push(m);
    }

    expect(counts.length).toBeGreaterThan(0);
    expect(seenMethods.length).toBeGreaterThan(0);
    expect(seenMethods).toContain("values");
  });
});
