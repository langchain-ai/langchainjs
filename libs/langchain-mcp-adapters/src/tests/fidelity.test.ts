import { beforeEach, describe, expect, test, vi } from "vitest";
import { Client, type Tool } from "@modelcontextprotocol/client";
import { Command, GraphInterrupt } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { loadMcpTools } from "../tools.js";

// Spy on SDK methods instead of replacing protocol types and validators.
function mockClient(inputSchema: Tool["inputSchema"] = { type: "object" }) {
  const client = new Client({ name: "fidelity-test", version: "1" });
  vi.spyOn(client, "listTools").mockResolvedValue({
    tools: [{ name: "echo", inputSchema }],
  });
  vi.spyOn(client, "callTool").mockResolvedValue({
    content: [{ type: "text", text: "ok" }],
  });

  return client;
}

beforeEach(() => vi.restoreAllMocks());

describe("original server schema", () => {
  test("does not mutate descriptors without properties", async () => {
    const schema = Object.freeze({
      type: "object",
    } satisfies Tool["inputSchema"]);

    await expect(
      loadMcpTools("test", mockClient(schema))
    ).resolves.toHaveLength(1);
    expect(schema).toEqual({ type: "object" });
  });

  test("validates hook overrides against constraints removed from model projection", async () => {
    const client = mockClient({
      type: "object",
      properties: { value: { type: "number" } },
      required: ["value"],
      not: { properties: { value: { const: 2 } } },
    });

    const [tool] = await loadMcpTools("test", client, {
      beforeToolCall: () => ({ args: { value: 2 } }),
    });

    await expect(tool.invoke({ value: 1 })).rejects.toThrow(/arguments/);
    expect(client.callTool).not.toHaveBeenCalled();
  });

  test("accepts valid effective arguments with local references", async () => {
    const client = mockClient({
      type: "object",
      $defs: { value: { type: "integer", minimum: 1 } },
      properties: { value: { $ref: "#/$defs/value" } },
      required: ["value"],
      additionalProperties: false,
    });

    const [tool] = await loadMcpTools("test", client, {
      beforeToolCall: () => ({ args: { value: 3 } }),
    });

    expect(await tool.invoke({ value: 1 })).toBe("ok");
    expect(client.callTool).toHaveBeenCalledWith({
      name: "echo",
      arguments: { value: 3 },
    });
  });
});

describe("result fidelity", () => {
  test.each(
    [false, 0, null, [], { value: 1 }].map((structuredContent) => ({
      structuredContent,
    }))
  )(
    "preserves structured data $structuredContent through a no-op hook",
    async ({ structuredContent }) => {
      const client = mockClient();
      vi.mocked(client.callTool).mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
        structuredContent,
        _meta: { private: "metadata" },
      });

      const [tool] = await loadMcpTools("test", client, {
        afterToolCall: ({ result }) => ({ result }),
      });

      const output = await tool.invoke({
        type: "tool_call",
        id: "call",
        name: "echo",
        args: {},
      });

      expect(ToolMessage.isInstance(output)).toBe(true);
      expect(output.content).toBe("ok");
      expect(output.artifact).toEqual(
        expect.arrayContaining([
          { type: "mcp_structured_content", data: structuredContent },
          { type: "mcp_meta", data: { private: "metadata" } },
        ])
      );
    }
  );

  test("preserves native ToolMessage identity and error status", async () => {
    const message = new ToolMessage({
      content: "denied",
      tool_call_id: "original",
      status: "error",
      artifact: { reason: "policy" },
    });

    const [tool] = await loadMcpTools("test", mockClient(), {
      afterToolCall: () => ({ result: message }),
    });

    expect(
      await tool.invoke({
        type: "tool_call",
        id: "call",
        name: "echo",
        args: {},
      })
    ).toBe(message);
  });

  test("preserves native Commands", async () => {
    const command = new Command({ update: { approved: true } });

    const [tool] = await loadMcpTools("test", mockClient(), {
      afterToolCall: () => ({ result: command }),
    });

    expect(await tool.invoke({})).toBe(command);
  });

  test("does not wrap GraphInterrupt", async () => {
    const interrupt = new GraphInterrupt([
      { value: "approval", id: "approval" },
    ]);

    const [tool] = await loadMcpTools("test", mockClient(), {
      beforeToolCall: () => {
        throw interrupt;
      },
    });

    await expect(tool.invoke({})).rejects.toBe(interrupt);
  });
});

test.each([
  {
    constraint: {
      anyOf: [
        { properties: { value: { const: 1 } } },
        { properties: { value: { const: 3 } } },
      ],
    },
    value: 2,
  },
  {
    constraint: {
      oneOf: [
        { properties: { value: { minimum: 1 } } },
        { properties: { value: { minimum: 2 } } },
      ],
    },
    value: 3,
  },
  {
    constraint: {
      allOf: [
        { properties: { value: { minimum: 1 } } },
        { properties: { value: { maximum: 2 } } },
      ],
    },
    value: 3,
  },
  {
    constraint: {
      if: { properties: { value: { minimum: 2 } } },
      then: { properties: { value: { minimum: 4 } } },
    },
    value: 3,
  },
])(
  "validates effective arguments against $constraint",
  async ({ constraint, value }) => {
    const client = mockClient({
      type: "object",
      properties: { value: { type: "number" } },
      ...constraint,
    });

    const [tool] = await loadMcpTools("test", client, {
      beforeToolCall: () => ({ args: { value } }),
    });

    await expect(tool.invoke({ value: 1 })).rejects.toThrow(/arguments/);
    expect(client.callTool).not.toHaveBeenCalled();
  }
);

test("rejects additional properties added by a hook", async () => {
  const client = mockClient({
    type: "object",
    properties: {},
    additionalProperties: false,
  });

  const [tool] = await loadMcpTools("test", client, {
    beforeToolCall: () => ({ args: { injected: true } }),
  });

  await expect(tool.invoke({})).rejects.toThrow(/additional properties/);
  expect(client.callTool).not.toHaveBeenCalled();
});

test("preserves semantic error envelopes and transport causes separately", async () => {
  const client = mockClient();

  const result = {
    isError: true,
    content: [{ type: "text", text: "denied" }],
    structuredContent: false,
    _meta: { reason: "policy" },
  } satisfies Awaited<ReturnType<Client["callTool"]>>;

  vi.mocked(client.callTool).mockResolvedValueOnce(result);
  const [tool] = await loadMcpTools("test", client);
  await expect(tool.invoke({})).rejects.toMatchObject({
    name: "ToolException",
    result,
  });
  const failure = new Error("connection lost");
  vi.mocked(client.callTool).mockRejectedValueOnce(failure);
  await expect(tool.invoke({})).rejects.toMatchObject({
    name: "ToolException",
    cause: failure,
  });
});

test.each([true, false])(
  "preserves resource provenance without reading resources (standard=%s)",
  async (useStandardContentBlocks) => {
    const client = mockClient();
    const read = vi.spyOn(client, "readResource");

    const content = [
      {
        type: "resource",
        resource: {
          uri: "memory://embedded",
          text: "embedded",
          mimeType: "text/plain",
          _meta: { private: true },
        },
      },
      {
        type: "resource_link",
        uri: "memory://reference",
        name: "reference",
        _meta: { private: true },
      },
    ] satisfies Awaited<ReturnType<Client["callTool"]>>["content"];

    vi.mocked(client.callTool).mockResolvedValue({ content });

    const [tool] = await loadMcpTools("test", client, {
      useStandardContentBlocks,
      outputHandling: "content",
      afterToolCall: ({ result }) => ({ result }),
    });

    const output = await tool.invoke({
      type: "tool_call",
      name: "echo",
      id: "call",
      args: {},
    });

    expect(output.artifact).toEqual(
      content.map((data) => ({ type: "mcp_content", data }))
    );
    expect(JSON.stringify(output.content)).not.toContain("private");
    expect(JSON.stringify(output.content)).toContain("memory://embedded");
    expect(read).not.toHaveBeenCalled();
  }
);

test("does not invent structured output when it is absent", async () => {
  const client = mockClient();

  const [tool] = await loadMcpTools("test", client, {
    afterToolCall: ({ result }) => ({ result }),
  });

  const output = await tool.invoke({
    type: "tool_call",
    id: "call",
    name: "echo",
    args: {},
  });

  expect(output.content).toBe("ok");
  expect(output.artifact).toEqual([]);
});

test("rejects a required value removed by a hook", async () => {
  const client = mockClient({
    type: "object",
    properties: { value: { type: "string" } },
    required: ["value"],
  });

  const [tool] = await loadMcpTools("test", client, {
    beforeToolCall: () => ({ args: { value: undefined } }),
  });

  await expect(tool.invoke({ value: "original" })).rejects.toThrow(/arguments/);
  expect(client.callTool).not.toHaveBeenCalled();
});

describe("validator identity", () => {
  function descriptor(id: string, forbidden: number): Tool["inputSchema"] {
    return {
      $id: id,
      type: "object",
      properties: { value: { type: "number" } },
      $defs: { forbidden: { properties: { value: { const: forbidden } } } },
      not: { $ref: "#/$defs/forbidden" },
    };
  }

  test("isolates servers advertising different constraints under the same schema ID", async () => {
    const id = "https://example.com/schema/shared";
    const firstClient = mockClient(descriptor(id, 2));
    const secondClient = mockClient(descriptor(id, 1));
    const [first] = await loadMcpTools("first", firstClient);
    const [second] = await loadMcpTools("second", secondClient);
    await expect(second.invoke({ value: 1 })).rejects.toThrow(/arguments/);
    expect(secondClient.callTool).not.toHaveBeenCalled();
    expect(await second.invoke({ value: 2 })).toBe("ok");
    expect(await first.invoke({ value: 1 })).toBe("ok");
    await expect(first.invoke({ value: 2 })).rejects.toThrow(/arguments/);
  });

  test("recompiles changed constraints on rediscovery without changing existing tools", async () => {
    const id = "https://example.com/schema/refreshed";
    const client = mockClient(descriptor(id, 2));
    const [original] = await loadMcpTools("test", client);
    vi.mocked(client.listTools).mockResolvedValue({
      tools: [{ name: "echo", inputSchema: descriptor(id, 1) }],
    });
    const [refreshed] = await loadMcpTools("test", client);
    await expect(refreshed.invoke({ value: 1 })).rejects.toThrow(/arguments/);
    expect(client.callTool).not.toHaveBeenCalled();
    expect(await refreshed.invoke({ value: 2 })).toBe("ok");
    expect(await original.invoke({ value: 1 })).toBe("ok");
    await expect(original.invoke({ value: 2 })).rejects.toThrow(/arguments/);
  });
});
