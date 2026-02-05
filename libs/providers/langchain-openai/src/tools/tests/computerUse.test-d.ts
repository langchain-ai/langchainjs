import { expectTypeOf, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Computer Use Tool Tests", () => {
  it("should propagate command types", () => {
    tools.computerUse({
      displayWidth: 1024,
      displayHeight: 768,
      environment: "browser",
      execute: async (cmd) => {
        expectTypeOf(cmd.type).toEqualTypeOf<
          | "type"
          | "click"
          | "double_click"
          | "drag"
          | "keypress"
          | "move"
          | "screenshot"
          | "scroll"
          | "wait"
        >();
        return "";
      },
    });
  });
});
