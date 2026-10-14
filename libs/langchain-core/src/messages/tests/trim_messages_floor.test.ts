import { describe, expect, it } from "vitest";
import { AIMessage } from "../ai.js";
import { BaseMessage } from "../base.js";
import { HumanMessage } from "../human.js";
import { SystemMessage } from "../system.js";
import { ToolMessage } from "../tool.js";
import { trimMessages } from "../transformers.js";

describe("trimMessages floorTokens", () => {
  const messages = Array.from(
    { length: 6 },
    (_, i) => new HumanMessage({ content: `${i}`, id: `${i}` })
  );
  const options = {
    maxTokens: 5,
    floorTokens: 2,
    tokenCounter: (msgs: BaseMessage[]) => msgs.length,
  };

  it("keeps the input through the ceiling and evicts to the floor above it", async () => {
    for (const count of [0, 2, 4, 5]) {
      expect(await trimMessages(messages.slice(0, count), options)).toEqual(
        messages.slice(0, count)
      );
    }
    expect(await trimMessages(messages, options)).toEqual(messages.slice(-2));
    expect(messages.map((message) => message.id)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("supports zero and equal floors and preserves omitted-option behavior", async () => {
    expect(
      await trimMessages(messages, { ...options, floorTokens: 0 })
    ).toEqual([]);
    const legacy = await trimMessages(messages, {
      maxTokens: 5,
      tokenCounter: options.tokenCounter,
    });
    expect(
      await trimMessages(messages, { ...options, floorTokens: 5 })
    ).toEqual(legacy);
  });

  it("returns an empty array when a system message cannot fit without a floor", async () => {
    expect(
      await trimMessages([new SystemMessage("instructions")], {
        maxTokens: 0,
        tokenCounter: options.tokenCounter,
        includeSystem: true,
      })
    ).toEqual([]);
  });

  it("supports async counters and Runnable invocation", async () => {
    const trimmer = trimMessages({
      ...options,
      tokenCounter: async (msgs) => msgs.length,
    });
    expect(await trimmer.invoke(messages)).toEqual(messages.slice(-2));
  });

  it("uses the floor for partial messages without mutating the original", async () => {
    const original = new HumanMessage("abcdef");
    const partialOptions = {
      maxTokens: 5,
      floorTokens: 2,
      allowPartial: true,
      tokenCounter: (msgs: BaseMessage[]) =>
        msgs.reduce((total, msg) => total + String(msg.content).length, 0),
      textSplitter: (text: string) => text.split(""),
    };
    const trimmed = await trimMessages([original], partialOptions);
    expect(trimmed.map((msg) => msg.content)).toEqual(["ef"]);
    expect(original.content).toBe("abcdef");
    const belowCeiling = new HumanMessage("abcde");
    expect(await trimMessages([belowCeiling], partialOptions)).toEqual([
      belowCeiling,
    ]);
  });

  it.each([-1, 6, NaN, Infinity, -Infinity])(
    "rejects invalid floor %s",
    async (floorTokens) => {
      await expect(
        trimMessages(messages, { ...options, floorTokens })
      ).rejects.toThrow("`floorTokens`");
    }
  );

  it.each([NaN, Infinity, -Infinity])(
    "rejects nonfinite ceiling %s when a floor is set",
    async (maxTokens) => {
      await expect(
        trimMessages(messages, { ...options, maxTokens })
      ).rejects.toThrow("`floorTokens`");
    }
  );

  it("rejects the first strategy", async () => {
    await expect(
      trimMessages(messages, { ...options, strategy: "first" })
    ).rejects.toThrow("'last'");
  });

  it("applies startOn and endOn even below the ceiling", async () => {
    const input = [
      new AIMessage("old"),
      new HumanMessage("question"),
      new AIMessage("answer"),
    ];
    expect(
      await trimMessages(input, {
        ...options,
        startOn: "human",
        endOn: "human",
      })
    ).toEqual([input[1]]);
  });

  it("counts the full input for the trigger before applying endOn", async () => {
    const input = [
      new HumanMessage("question"),
      ...Array.from({ length: 5 }, () => new AIMessage("answer")),
    ];
    expect(
      await trimMessages(input, { ...options, floorTokens: 0, endOn: "human" })
    ).toEqual([]);
  });

  it("preserves a system message and complete tool exchanges with human boundaries", async () => {
    const system = new SystemMessage("instructions");
    const human = new HumanMessage("new question");
    const ai = new AIMessage({
      content: "",
      tool_calls: [{ name: "lookup", args: {}, id: "call" }],
    });
    const tool = new ToolMessage({ content: "result", tool_call_id: "call" });
    const input = [
      system,
      new HumanMessage("old"),
      new AIMessage("old answer"),
      human,
      ai,
      tool,
    ];
    expect(
      await trimMessages(input, {
        ...options,
        floorTokens: 4,
        includeSystem: true,
        startOn: "human",
        allowPartial: false,
      })
    ).toEqual([system, human, ai, tool]);
    expect(
      await trimMessages(input, {
        ...options,
        floorTokens: 3,
        includeSystem: true,
        startOn: "human",
        allowPartial: false,
      })
    ).toEqual([]);
    expect(
      await trimMessages(input, {
        ...options,
        floorTokens: 0,
        includeSystem: true,
      })
    ).toEqual([]);
  });

  it("leaves persisted history as an unchanged prefix between evictions over 20 turns", async () => {
    let history: BaseMessage[] = [];
    const evictions: number[] = [];
    for (let turn = 1; turn <= 20; turn += 1) {
      const previous = history;
      const input = [
        ...previous,
        new HumanMessage({ content: `turn ${turn}`, id: `${turn}` }),
      ];
      history = await trimMessages(input, options);
      if (input.length > options.maxTokens) {
        evictions.push(turn);
        expect(history).toEqual(input.slice(-options.floorTokens));
      } else {
        expect(history.slice(0, previous.length)).toEqual(previous);
      }
      expect(history.length).toBeLessThanOrEqual(options.maxTokens);
    }
    expect(evictions).toEqual([6, 10, 14, 18]);
  });
});
