import { expect, it, describe } from "vitest";
import { computer_20251124, computer_20250124 } from "../computer.js";

describe("Anthropic Computer Use Tool Unit Tests", () => {
  describe("computer_20251124 (Claude Opus 4.5)", () => {
    it("creates a valid computer tool with required options", () => {
      const computer = computer_20251124({
        displayWidthPx: 1024,
        displayHeightPx: 768,
      });

      expect(computer.name).toBe("computer");
      expect(computer.extras?.providerToolDefinition).toMatchInlineSnapshot(`
        {
          "display_height_px": 768,
          "display_width_px": 1024,
          "name": "computer",
          "type": "computer_20251124",
        }
      `);
    });

    it("creates a valid computer tool with all options", () => {
      const computer = computer_20251124({
        displayWidthPx: 1280,
        displayHeightPx: 800,
        displayNumber: 1,
        enableZoom: true,
      });

      expect(computer.name).toBe("computer");
      expect(computer.extras?.providerToolDefinition).toMatchInlineSnapshot(`
        {
          "display_height_px": 800,
          "display_number": 1,
          "display_width_px": 1280,
          "enable_zoom": true,
          "name": "computer",
          "type": "computer_20251124",
        }
      `);
    });

    it("creates a valid computer tool with execute function", async () => {
      const mockExecute = async (args: { action: string }) => {
        return `Executed ${args.action}`;
      };

      const computer = computer_20251124({
        displayWidthPx: 1024,
        displayHeightPx: 768,
        execute: mockExecute,
      });

      expect(computer.name).toBe("computer");
      expect(computer.func).toBeDefined();
    });
  });

  describe("computer_20250124 (Claude 4 / Claude 3.7)", () => {
    it("creates a valid computer tool with required options", () => {
      const computer = computer_20250124({
        displayWidthPx: 1024,
        displayHeightPx: 768,
      });

      expect(computer.name).toBe("computer");
      expect(computer.extras?.providerToolDefinition).toMatchInlineSnapshot(`
        {
          "display_height_px": 768,
          "display_width_px": 1024,
          "name": "computer",
          "type": "computer_20250124",
        }
      `);
    });

    it("creates a valid computer tool with display number", () => {
      const computer = computer_20250124({
        displayWidthPx: 1024,
        displayHeightPx: 768,
        displayNumber: 2,
      });

      expect(computer.name).toBe("computer");
      expect(computer.extras?.providerToolDefinition).toMatchInlineSnapshot(`
        {
          "display_height_px": 768,
          "display_number": 2,
          "display_width_px": 1024,
          "name": "computer",
          "type": "computer_20250124",
        }
      `);
    });

    it("creates a valid computer tool with execute function", async () => {
      const mockExecute = async (args: { action: string }) => {
        return `Executed ${args.action}`;
      };

      const computer = computer_20250124({
        displayWidthPx: 1024,
        displayHeightPx: 768,
        execute: mockExecute,
      });

      expect(computer.name).toBe("computer");
      expect(computer.func).toBeDefined();
    });
  });
});
