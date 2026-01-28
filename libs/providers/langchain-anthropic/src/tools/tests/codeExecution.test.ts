import { expect, it, describe } from "vitest";
import { codeExecution_20250825 } from "../codeExecution.js";

describe("Anthropic Code Execution Tool Unit Tests", () => {
  describe("codeExecution_20250825", () => {
    it("creates a valid code execution tool with no options", () => {
      expect(codeExecution_20250825()).toMatchInlineSnapshot(`
        {
          "cache_control": undefined,
          "name": "code_execution",
          "type": "code_execution_20250825",
        }
      `);
    });

    it("creates a valid code execution tool with cache control", () => {
      expect(
        codeExecution_20250825({
          cacheControl: { type: "ephemeral" },
        })
      ).toMatchInlineSnapshot(`
        {
          "cache_control": {
            "type": "ephemeral",
          },
          "name": "code_execution",
          "type": "code_execution_20250825",
        }
      `);
    });
  });
});
