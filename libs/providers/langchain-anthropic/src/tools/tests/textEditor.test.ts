import { expect, it, describe } from "vitest";
import { textEditor_20250728 } from "../textEditor.js";

describe("Anthropic Text Editor Tool Unit Tests", () => {
  describe("textEditor_20250728 (Claude 4.x)", () => {
    it("creates a valid text editor tool with no options", () => {
      const editor = textEditor_20250728();

      expect(editor.name).toBe("str_replace_based_edit_tool");
      expect(editor.extras?.providerToolDefinition).toMatchInlineSnapshot(`
        {
          "name": "str_replace_based_edit_tool",
          "type": "text_editor_20250728",
        }
      `);
    });

    it("creates a valid text editor tool with maxCharacters option", () => {
      const editor = textEditor_20250728({
        maxCharacters: 10000,
      });

      expect(editor.name).toBe("str_replace_based_edit_tool");
      expect(editor.extras?.providerToolDefinition).toMatchInlineSnapshot(`
        {
          "max_characters": 10000,
          "name": "str_replace_based_edit_tool",
          "type": "text_editor_20250728",
        }
      `);
    });

    it("creates a valid text editor tool with execute function", async () => {
      const mockExecute = async (args: { command: string; path: string }) => {
        return `Executed ${args.command} on ${args.path}`;
      };

      const editor = textEditor_20250728({
        execute: mockExecute,
      });

      expect(editor.name).toBe("str_replace_based_edit_tool");
      expect(editor.func).toBeDefined();
    });
  });
});
