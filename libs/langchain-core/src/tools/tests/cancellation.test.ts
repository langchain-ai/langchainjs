import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v3";
import { tool } from "../index.js";

describe("structured tool cancellation", () => {
  it("rejects an already aborted call before executing its function", async () => {
    const reason = new Error("Caller cancelled this turn");
    const run = vi.fn(() => {
      throw new Error("Cancelled tool function executed");
    });
    const action = tool(run, {
      name: "action",
      schema: z.object({ value: z.string() }),
    });

    await expect(
      action.invoke({ value: "input" }, { signal: AbortSignal.abort(reason) })
    ).rejects.toBe(reason);
    expect(run).not.toHaveBeenCalled();
  });

  it("still executes a call with an active signal", async () => {
    const run = vi.fn(({ value }: { value: string }) => value);
    const action = tool(run, {
      name: "action",
      schema: z.object({ value: z.string() }),
    });

    await expect(
      action.invoke(
        { value: "input" },
        { signal: new AbortController().signal }
      )
    ).resolves.toBe("input");
    expect(run).toHaveBeenCalledOnce();
  });

  it.each(["Stopped", undefined])(
    "normalizes a pre-aborted reason %s without starting the tool",
    async (reason) => {
      const run = vi.fn(() => "unexpected execution");
      const action = tool(run, {
        name: "action",
        schema: z.object({ value: z.string() }),
      });
      const signal = AbortSignal.abort(reason);

      await expect(
        action.invoke({ value: "input" }, { signal })
      ).rejects.toThrow(reason ?? signal.reason.message);
      expect(run).not.toHaveBeenCalled();
    }
  );

  it("rejects when cancellation happens during the tool function", async () => {
    const controller = new AbortController();
    const reason = new Error("Stopped during execution");
    const action = tool(
      () => {
        controller.abort(reason);
        return "late result";
      },
      { name: "action", schema: z.object({ value: z.string() }) }
    );

    await expect(
      action.invoke({ value: "input" }, { signal: controller.signal })
    ).rejects.toBe(reason);
  });
});
