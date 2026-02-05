import { expectTypeOf, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Apply Patch Tool Type Tests", () => {
  it("applyPatch execute receives correct operation types", () => {
    tools.applyPatch({
      execute: async (operation) => {
        expectTypeOf(operation.type).toEqualTypeOf<
          "create_file" | "update_file" | "delete_file"
        >();
        expectTypeOf(operation.path).toEqualTypeOf<string>();
        return "done";
      },
    });
  });
});
