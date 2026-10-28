import { describe, expect, it } from "vitest";
import { AIMessage } from "../ai.js";
import { HumanMessage } from "../human.js";
import {
  addNotificationMetadata,
  getNotificationMetadata,
} from "../notification.js";
import { SystemMessage } from "../system.js";
import { ToolMessage } from "../tool.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "../utils.js";

describe("addNotificationMetadata", () => {
  it("adds the metadata to a copy", () => {
    const original = new HumanMessage({
      content: "done",
      id: "msg_1",
      additional_kwargs: { other: 1 },
    });

    const message = addNotificationMetadata(original, {
      source: "async_subagent",
      data: { task_id: "t_42" },
    });

    expect(message).toBeInstanceOf(HumanMessage);
    expect(message.id).toBe("msg_1");
    expect(message.content).toBe("done");
    expect(message.additional_kwargs).toEqual({
      other: 1,
      lc_source: "async_subagent",
      lc_data: { task_id: "t_42" },
    });
    expect(original.additional_kwargs).toEqual({ other: 1 });
  });

  it("keeps the fields of other message types", () => {
    const ai = new AIMessage({
      content: "",
      tool_calls: [{ id: "c1", name: "search", args: {} }],
    });
    const tool = new ToolMessage({ content: "ok", tool_call_id: "c1" });

    const markedAi = addNotificationMetadata(ai, { source: "a" });
    const markedTool = addNotificationMetadata(tool, { source: "t" });

    expect(markedAi).toBeInstanceOf(AIMessage);
    expect(markedAi.tool_calls).toEqual(ai.tool_calls);
    expect(markedTool.tool_call_id).toBe("c1");
    expect(
      getNotificationMetadata(
        addNotificationMetadata(new SystemMessage("skills"), { source: "s" })
      )
    ).toEqual({ source: "s" });
  });

  it("keeps fields set after the message was built", () => {
    const ai = new AIMessage({ content: "answer" });
    ai.response_metadata = { model_name: "m", finish_reason: "stop" };
    ai.usage_metadata = { input_tokens: 1, output_tokens: 2, total_tokens: 3 };
    const human = new HumanMessage("first");
    human.id = "msg_1";
    human.name = "user";
    human.content = "second";

    const markedAi = addNotificationMetadata(ai, { source: "a" });
    const markedHuman = addNotificationMetadata(human, { source: "h" });

    expect(markedAi.response_metadata).toEqual(ai.response_metadata);
    expect(markedAi.usage_metadata).toEqual(ai.usage_metadata);
    expect(markedHuman.id).toBe("msg_1");
    expect(markedHuman.name).toBe("user");
    expect(markedHuman.content).toBe("second");
  });

  it("replaces earlier source and data", () => {
    const message = addNotificationMetadata(new HumanMessage("x"), {
      source: "first",
      data: { a: 1 },
    });

    const remarked = addNotificationMetadata(message, { source: "second" });

    expect(getNotificationMetadata(remarked)).toEqual({ source: "second" });
  });

  it("copies data", () => {
    const data = { status: "success" };
    const message = addNotificationMetadata(new HumanMessage("x"), {
      source: "s",
      data,
    });
    data.status = "error";

    expect(getNotificationMetadata(message)).toEqual({
      source: "s",
      data: { status: "success" },
    });
  });

  it("keeps the metadata through serialization", () => {
    const message = addNotificationMetadata(
      new HumanMessage({ content: "done", id: "msg_1" }),
      { source: "async_subagent", data: { a: 1 } }
    );

    const [restored] = mapStoredMessagesToChatMessages(
      mapChatMessagesToStoredMessages([message])
    );

    expect(restored.id).toBe("msg_1");
    expect(getNotificationMetadata(restored)).toEqual({
      source: "async_subagent",
      data: { a: 1 },
    });
  });
});

describe("getNotificationMetadata", () => {
  it("returns undefined without a string source", () => {
    expect(getNotificationMetadata(new HumanMessage("hi"))).toBeUndefined();
    expect(
      getNotificationMetadata(
        new HumanMessage({ content: "x", additional_kwargs: { lc_source: 1 } })
      )
    ).toBeUndefined();
  });

  it("leaves out data that isn't an object", () => {
    const message = new HumanMessage({
      content: "x",
      additional_kwargs: { lc_source: "s", lc_data: "not an object" },
    });

    expect(getNotificationMetadata(message)).toEqual({ source: "s" });
  });
});
