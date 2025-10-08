import { describe, it } from "vitest";
import { z } from "zod/v3";

import type { WithMaybeContext } from "../types.js";

describe("WithMaybeContext", () => {
  it("should detect context as optional if it has defaults", () => {
    const contextSchema = z
      .object({
        customDefaultContextProp: z.string().default("default value"),
        customOptionalContextProp: z.string().optional(),
        customRequiredContextProp: z.string(),
      })
      .default({
        customRequiredContextProp: "default value",
      });

    const a: WithMaybeContext<typeof contextSchema> = {};
    console.log(a);
  });
});
