import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Computer Use Tool Tests", () => {
  it("computerUse creates a valid tool for browser environment", () => {
    const computer = tools.computerUse({
      displayWidth: 1024,
      displayHeight: 768,
      environment: "browser",
      execute: async () => "",
    });

    expect(computer.name).toBe("computer_use");
    expect(computer.extras?.providerToolDefinition).toMatchInlineSnapshot(`
      {
        "display_height": 768,
        "display_width": 1024,
        "environment": "browser",
        "type": "computer_use_preview",
      }
    `);
  });
});
