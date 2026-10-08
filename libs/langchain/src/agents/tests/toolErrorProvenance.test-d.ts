import { expectTypeOf, test } from "vitest";
import { z } from "zod/v3";
import { createMiddleware, markToolErrorAsFatal } from "../../index.js";

test("fatal marker accepts typed middleware requests and unknown thrown values", () => {
  createMiddleware({
    name: "typedFatal",
    stateSchema: z.object({ attempts: z.number() }),
    contextSchema: z.object({ user: z.string() }),
    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error: unknown) {
        expectTypeOf(markToolErrorAsFatal(request, error)).toBeVoid();
        expectTypeOf(markToolErrorAsFatal({ ...request }, null)).toBeVoid();
        throw error;
      }
    },
  });
});
