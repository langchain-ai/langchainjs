import { describe, it, expect, vi } from "vitest";
import { z } from "zod/v3";

import { tool, composePolicies } from "../index.js";
import type { ToolPolicy } from "../policy.js";

function createAdder(policies?: ToolPolicy[]) {
  return tool(
    (input: { a: number; b: number }) => {
      return input.a + input.b;
    },
    {
      name: "adder",
      description: "Adds two numbers",
      schema: z.object({ a: z.number(), b: z.number() }),
      ...(policies !== undefined ? { policies } : {}),
    }
  );
}

describe("ToolPolicy", () => {
  describe("beforeInvoke", () => {
    it("runs before _call and can read args", async () => {
      const seen: unknown[] = [];
      const adder = createAdder([
        {
          beforeInvoke: (ctx) => {
            seen.push(ctx.args);
          },
        },
      ]);

      const result = await adder.invoke({ a: 1, b: 2 });
      expect(result).toBe(3);
      expect(seen).toEqual([{ a: 1, b: 2 }]);
    });

    it("aborts _call when it throws", async () => {
      const callSpy = vi.fn();
      const failing = tool(
        (input: { a: number; b: number }) => {
          callSpy();
          return input.a + input.b;
        },
        {
          name: "adder",
          description: "Adds two numbers",
          schema: z.object({ a: z.number(), b: z.number() }),
          policies: [
            {
              beforeInvoke: () => {
                throw new Error("denied");
              },
            },
          ],
        }
      );

      await expect(failing.invoke({ a: 1, b: 2 })).rejects.toThrow("denied");
      expect(callSpy).not.toHaveBeenCalled();
    });

    it("receives configurable from invoke config", async () => {
      let captured: Record<string, unknown> | undefined;
      const adder = createAdder([
        {
          beforeInvoke: (ctx) => {
            captured = ctx.config.configurable;
          },
        },
      ]);

      await adder.invoke(
        { a: 1, b: 2 },
        { configurable: { "test-key": "test-value" } }
      );
      expect(captured).toMatchObject({ "test-key": "test-value" });
    });
  });

  describe("afterInvoke", () => {
    it("transforms tool output", async () => {
      const adder = createAdder([
        {
          afterInvoke: (output) => {
            return (output as number) * 10;
          },
        },
      ]);

      const result = await adder.invoke({ a: 1, b: 2 });
      expect(result).toBe(30);
    });

    it("receives the original args in context", async () => {
      let captured: unknown;
      const adder = createAdder([
        {
          afterInvoke: (output, ctx) => {
            captured = ctx.args;
            return output;
          },
        },
      ]);

      await adder.invoke({ a: 5, b: 7 });
      expect(captured).toEqual({ a: 5, b: 7 });
    });

    it("aborts when it throws", async () => {
      const adder = createAdder([
        {
          afterInvoke: () => {
            throw new Error("filter failed");
          },
        },
      ]);

      await expect(adder.invoke({ a: 1, b: 2 })).rejects.toThrow(
        "filter failed"
      );
    });
  });

  describe("no policies", () => {
    it("behaves normally without policies", async () => {
      const adder = createAdder();
      const result = await adder.invoke({ a: 3, b: 4 });
      expect(result).toBe(7);
    });
  });

  describe("multiple policies", () => {
    it("runs beforeInvoke in forward order", async () => {
      const order: string[] = [];
      const adder = createAdder([
        {
          beforeInvoke: () => {
            order.push("first");
          },
        },
        {
          beforeInvoke: () => {
            order.push("second");
          },
        },
        {
          beforeInvoke: () => {
            order.push("third");
          },
        },
      ]);

      await adder.invoke({ a: 1, b: 2 });
      expect(order).toEqual(["first", "second", "third"]);
    });

    it("runs afterInvoke in forward order", async () => {
      const order: string[] = [];
      const adder = createAdder([
        {
          afterInvoke: (out) => {
            order.push("first");
            return out;
          },
        },
        {
          afterInvoke: (out) => {
            order.push("second");
            return out;
          },
        },
        {
          afterInvoke: (out) => {
            order.push("third");
            return out;
          },
        },
      ]);

      await adder.invoke({ a: 1, b: 2 });
      expect(order).toEqual(["first", "second", "third"]);
    });

    it("chains afterInvoke transformations", async () => {
      const adder = createAdder([
        { afterInvoke: (out) => (out as number) + 100 },
        { afterInvoke: (out) => (out as number) * 2 },
      ]);

      const result = await adder.invoke({ a: 1, b: 2 });
      // _call returns 3, first adds 100 → 103, second doubles → 206
      expect(result).toBe(206);
    });

    it("stops on beforeInvoke throw from any policy", async () => {
      const callSpy = vi.fn();
      const adder = createAdder([
        {
          beforeInvoke: () => {
            callSpy();
          },
        },
        {
          beforeInvoke: () => {
            throw new Error("blocked");
          },
        },
        {
          beforeInvoke: () => {
            callSpy();
          },
        },
      ]);

      await expect(adder.invoke({ a: 1, b: 2 })).rejects.toThrow("blocked");
      expect(callSpy).toHaveBeenCalledTimes(1);
    });

    it("skips undefined hooks gracefully", async () => {
      const adder = createAdder([{}, { beforeInvoke: () => {} }, {}]);

      const result = await adder.invoke({ a: 2, b: 3 });
      expect(result).toBe(5);
    });
  });

  describe("composePolicies", () => {
    it("composes into a single policy that runs in forward order", async () => {
      const order: string[] = [];
      const composed = composePolicies(
        {
          beforeInvoke: () => {
            order.push("first");
          },
        },
        {
          beforeInvoke: () => {
            order.push("second");
          },
        }
      );

      const adder = createAdder([composed]);
      await adder.invoke({ a: 1, b: 2 });
      expect(order).toEqual(["first", "second"]);
    });

    it("chains afterInvoke transformations in forward order", async () => {
      const composed = composePolicies(
        { afterInvoke: (out) => (out as number) + 100 },
        { afterInvoke: (out) => (out as number) * 2 }
      );

      const adder = createAdder([composed]);
      const result = await adder.invoke({ a: 1, b: 2 });
      expect(result).toBe(206);
    });
  });
});
