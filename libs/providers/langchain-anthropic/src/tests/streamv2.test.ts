import { describe, expect, test } from "vitest";
import {
  getAnthropicContentBlockIndex,
  mergeAnthropicProtocolContentBlock,
  omitUndefinedContentBlockValues,
  shouldSkipAnthropicStreamv2ProtocolBlock,
} from "../streamv2.js";

describe("omitUndefinedContentBlockValues", () => {
  test("drops undefined keys", () => {
    expect(
      omitUndefinedContentBlockValues({
        type: "tool_call_chunk",
        id: undefined,
        name: undefined,
        args: "",
        index: 0,
      })
    ).toEqual({
      type: "tool_call_chunk",
      args: "",
      index: 0,
    });
  });
});

describe("shouldSkipAnthropicStreamv2ProtocolBlock", () => {
  const serverToolIndices = new Set<number>([0]);
  const blockStates = new Map<
    number,
    { type: "server_tool_call_chunk"; id: string }
  >([[0, { type: "server_tool_call_chunk", id: "x" }]]);

  test("skips tool_call_chunk for a server-tool index", () => {
    expect(
      shouldSkipAnthropicStreamv2ProtocolBlock(
        { type: "tool_call_chunk", args: '{"q":' },
        0,
        serverToolIndices,
        blockStates
      )
    ).toBe(true);
  });

  test("does not skip the first server_tool_call before block state exists", () => {
    expect(
      shouldSkipAnthropicStreamv2ProtocolBlock(
        {
          type: "server_tool_call",
          id: "srv",
          name: "web_search",
          args: { query: "" },
        },
        0,
        serverToolIndices,
        new Map()
      )
    ).toBe(false);
  });

  test("skips duplicate server_tool_call snapshots after block state exists", () => {
    expect(
      shouldSkipAnthropicStreamv2ProtocolBlock(
        {
          type: "server_tool_call",
          id: "srv",
          name: "web_search",
          args: { query: "a" },
        },
        0,
        serverToolIndices,
        blockStates
      )
    ).toBe(true);
  });

  test("does not skip client tool_call_chunk at a non-server index", () => {
    expect(
      shouldSkipAnthropicStreamv2ProtocolBlock(
        { type: "tool_call_chunk", id: "c", name: "foo", args: "" },
        1,
        serverToolIndices,
        blockStates
      )
    ).toBe(false);
  });
});

describe("getAnthropicContentBlockIndex", () => {
  test("uses nested value.index for non_standard citation chunks", () => {
    expect(
      getAnthropicContentBlockIndex(
        {
          type: "non_standard",
          value: {
            index: 5,
            type: "text",
            citations: [{ type: "web_search_result_location" }],
          },
        },
        0
      )
    ).toBe(5);
  });

  test("prefers top-level index when set", () => {
    expect(
      getAnthropicContentBlockIndex(
        {
          type: "non_standard",
          index: 1,
          value: { index: 5, type: "text" },
        },
        0
      )
    ).toBe(1);
  });
});

describe("mergeAnthropicProtocolContentBlock", () => {
  test("concatenates incremental text, not repeated type", () => {
    const current = {
      index: 0,
      type: "text" as const,
      text: "Hello",
    };
    const delta = {
      index: 0,
      type: "text" as const,
      text: " world",
    };
    const merged = mergeAnthropicProtocolContentBlock(current, delta);
    expect(merged).toEqual({
      index: 0,
      type: "text",
      text: "Hello world",
    });
  });

  test("repeated identical type strings do not accumulate", () => {
    let acc = {
      index: 11,
      type: "text" as const,
      text: "",
    };
    for (let i = 0; i < 6; i += 1) {
      acc = mergeAnthropicProtocolContentBlock(acc, {
        index: 11,
        type: "text",
        text: "x",
      }) as typeof acc;
    }
    expect(acc.type).toBe("text");
    expect(acc.text).toBe("xxxxxx");
  });

  test("repeated id and name do not concatenate (server tool / tool chunks)", () => {
    const id = "srvtoolu_016rwxAzNaTnKH13YrYRW8mW";
    const name = "web_search";
    let acc = mergeAnthropicProtocolContentBlock(
      {
        index: 0,
        type: "server_tool_call_chunk",
        id,
        name,
        args: "",
      },
      {
        index: 0,
        type: "server_tool_call_chunk",
        id,
        name,
        args: "",
      }
    );
    acc = mergeAnthropicProtocolContentBlock(acc, {
      index: 0,
      type: "server_tool_call_chunk",
      id,
      name,
      args: '{"query": "x"',
    });
    acc = mergeAnthropicProtocolContentBlock(acc, {
      index: 0,
      type: "server_tool_call_chunk",
      id,
      name,
      args: "}",
    });
    expect(acc.type).toBe("server_tool_call_chunk");
    expect(acc.id).toBe(id);
    expect(acc.name).toBe(name);
    expect(acc.args).toBe('{"query": "x"}');
  });
});
