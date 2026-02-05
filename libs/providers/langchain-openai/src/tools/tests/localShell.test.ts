import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Local Shell Tool Tests", () => {
  it("localShell creates valid tool definitions", () => {
    const shell = tools.localShell({
      execute: async () => "output",
    });

    expect(shell.name).toBe("local_shell");
    expect(shell.extras?.providerToolDefinition).toMatchObject({
      type: "local_shell",
    });
  });
});
