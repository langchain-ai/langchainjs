import { describe, expect, it } from "vitest";
import {
  HumanMessage,
  NOTIFICATION_HEADER,
  createNotificationMessage,
} from "../human.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "../utils.js";

describe("createNotificationMessage", () => {
  it("starts string content with the header and note", () => {
    const message = createNotificationMessage("<status>success</status>", {
      source: "async_subagent",
      note: "A task finished.",
    });

    expect(message).toBeInstanceOf(HumanMessage);
    expect(message.content).toBe(
      `${NOTIFICATION_HEADER}\nA task finished.\n<status>success</status>`
    );
  });

  it("starts string content with the header when there is no note", () => {
    const message = createNotificationMessage("done", {
      source: "async_subagent",
    });

    expect(message.content).toBe(`${NOTIFICATION_HEADER}\ndone`);
  });

  it("copies data", () => {
    const data = { status: "success" };
    const message = createNotificationMessage("done", {
      source: "async_subagent",
      data,
    });
    data.status = "error";

    expect(message.additional_kwargs.lc_data).toEqual({ status: "success" });
  });

  it("keeps content unchanged without the header", () => {
    const message = createNotificationMessage("Here is a summary.", {
      source: "summarization",
      header: false,
    });

    expect(message.content).toBe("Here is a summary.");
    expect(message.additional_kwargs).toEqual({
      lc_synthetic: true,
      lc_source: "summarization",
    });
  });

  it("prepends a header block to content blocks", () => {
    const text = { type: "text" as const, text: "Frame 1" };
    const image = { type: "image" as const, url: "https://example.com/a.png" };
    const message = createNotificationMessage([text, image], {
      source: "read_file_media",
      note: "Frames from a video.",
    });

    expect(message.content).toEqual([
      { type: "text", text: `${NOTIFICATION_HEADER}\nFrames from a video.\n` },
      text,
      image,
    ]);
  });

  it("keeps its labels through serialization", () => {
    const message = createNotificationMessage("done", {
      source: "async_subagent",
      data: { task_id: "t_42", status: "success" },
      id: "msg_1",
    });

    const [restored] = mapStoredMessagesToChatMessages(
      mapChatMessagesToStoredMessages([message])
    );

    expect(restored.id).toBe("msg_1");
    expect(restored.additional_kwargs).toEqual({
      lc_synthetic: true,
      lc_source: "async_subagent",
      lc_data: { task_id: "t_42", status: "success" },
    });
  });

  it("rejects a note without the header", () => {
    expect(() =>
      createNotificationMessage("summary", {
        source: "summarization",
        note: "ignored",
        header: false,
      })
    ).toThrow("header: true");
  });
});
