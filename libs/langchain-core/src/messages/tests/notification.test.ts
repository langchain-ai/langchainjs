import { describe, expect, it } from "vitest";
import { HumanMessage } from "../human.js";
import { ToolMessage } from "../tool.js";
import {
  addNotificationMetadata,
  getNotificationMetadata,
} from "../notification.js";
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

  it("keeps a tool message a tool message", () => {
    const original = new ToolMessage({
      content: "denied",
      id: "msg_1",
      name: "send_email",
      tool_call_id: "call_1",
      status: "error",
      artifact: { detail: "kept" },
      additional_kwargs: { other: 1 },
    });

    const message = addNotificationMetadata(original, {
      source: "hitl_interrupt_decision",
      data: { decision: "reject" },
    });

    expect(message).toBeInstanceOf(ToolMessage);
    expect(message.id).toBe("msg_1");
    expect(message.content).toBe("denied");
    expect(message.name).toBe("send_email");
    expect(message.tool_call_id).toBe("call_1");
    expect(message.status).toBe("error");
    expect(message.artifact).toEqual({ detail: "kept" });
    expect(message.additional_kwargs).toEqual({
      other: 1,
      lc_source: "hitl_interrupt_decision",
      lc_data: { decision: "reject" },
    });
    expect(original.additional_kwargs).toEqual({ other: 1 });

    const [restored] = mapStoredMessagesToChatMessages(
      mapChatMessagesToStoredMessages([message])
    );

    expect(ToolMessage.isInstance(restored)).toBe(true);
    expect(getNotificationMetadata(restored)).toEqual({
      source: "hitl_interrupt_decision",
      data: { decision: "reject" },
    });
  });

  it("keeps fields set after the message was built", () => {
    const human = new HumanMessage("first");
    human.response_metadata = { source: "slack" };
    human.id = "msg_1";
    human.name = "user";
    human.content = "second";

    const markedHuman = addNotificationMetadata(human, { source: "h" });

    expect(markedHuman.response_metadata).toEqual({ source: "slack" });
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
