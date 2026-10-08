import { test, expect } from "vitest";
import { ChatModelStream } from "@langchain/core/language_models/stream";
import type { StreamEvent } from "@langchain/core/tracers/log_stream";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { ConfigurableModel } from "../universal.js";

// Skip provider lookup: always configure to a fake chat model.
class FakeConfigurableModel extends ConfigurableModel {
  async _model() {
    return new FakeListChatModel({ responses: ["Hello there"] });
  }
}

test("streamEvents() without a version returns a ChatModelStream", async () => {
  const stream = new FakeConfigurableModel({}).streamEvents("Hi");

  expect(stream).toBeInstanceOf(ChatModelStream);
  expect((await stream).text).toBe("Hello there");
});

test("streamEvents() with a version still streams callback events", async () => {
  const events: StreamEvent[] = [];
  for await (const event of new FakeConfigurableModel({}).streamEvents("Hi", {
    version: "v2",
  })) {
    events.push(event);
  }

  expect(events.map(({ event }) => event)).toContain("on_chat_model_stream");
});
