import { LangChainError } from "@langchain/core/errors";
import { Client } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { ToolException, isToolException, loadMcpTools } from "../tools.js";

describe("ToolException error formatting", () => {
  test("uses core error branding instead of accepting name-only lookalikes", () => {
    const error = new ToolException("Failure", new Error("Cause"));
    expect(ToolException.isInstance(error)).toBe(true);
    expect(isToolException(error)).toBe(true);
    expect(LangChainError.isInstance(error)).toBe(true);
    expect(isToolException({ name: "ToolException" })).toBe(false);
    expect(
      isToolException(
        Object.assign(new Error("Unrelated"), { name: "ToolException" })
      )
    ).toBe(false);
  });

  test("recognizes errors from separately loaded adapter modules", async () => {
    vi.resetModules();
    const other = await import("../tools.js");
    expect(other.ToolException).not.toBe(ToolException);
    const error = new other.ToolException("Other copy");
    expect(ToolException.isInstance(error)).toBe(true);
    expect(isToolException(error)).toBe(true);
  });

  test("preserves the original Zod error and structured issues", () => {
    const result = z.object({ count: z.number() }).safeParse({ count: "one" });
    if (result.success) throw new Error("Expected invalid input");
    const error = new ToolException("Invalid hook result", result.error);
    expect(error.cause).toBe(result.error);
    expect(result.error.issues[0]).toMatchObject({
      code: "invalid_type",
      path: ["count"],
    });
  });

  test("preserves ordinary and non-Error causes", () => {
    const cause = new Error("Connection failed");
    expect(new ToolException("Failure", cause).cause).toBe(cause);
    expect(new ToolException("Failure", null).cause).toBeNull();
    expect(new ToolException("Failure", false).cause).toBe(false);
  });
});

describe("tool invocation errors", () => {
  test("preserves semantic error envelopes and transport causes separately", async () => {
    const client = new Client({ name: "error-test", version: "1" });
    vi.spyOn(client, "listTools").mockResolvedValue({
      tools: [{ name: "echo", inputSchema: { type: "object" } }],
    });
    vi.spyOn(client, "callTool");

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

  test("retains SDK argument validation issues as a Zod error", async () => {
    const client = new Client({ name: "validation-test", version: "1" });
    vi.spyOn(client, "listTools").mockResolvedValue({
      tools: [
        {
          name: "echo",
          inputSchema: {
            type: "object",
            properties: { count: { type: "number", minimum: 1 } },
          },
        },
      ],
    });
    const call = vi.spyOn(client, "callTool");

    const [tool] = await loadMcpTools("test", client, {
      beforeToolCall: () => ({ args: { count: 0 } }),
    });

    await expect(tool.invoke({ count: 1 })).rejects.toMatchObject({
      name: "ToolException",
      cause: expect.any(z.ZodError),
    });
    expect(call).not.toHaveBeenCalled();
  });

  afterEach(() => vi.restoreAllMocks());
});
