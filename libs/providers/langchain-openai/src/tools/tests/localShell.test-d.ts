import { expectTypeOf, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Local Shell Tool Tests", () => {
  it("localShell creates valid tool definitions", () => {
    tools.localShell({
      execute: async (cmd) => {
        expectTypeOf(cmd.command).toEqualTypeOf<string[]>();
        return "output";
      },
    });
  });
});
