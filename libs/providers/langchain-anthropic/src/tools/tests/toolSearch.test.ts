import { expect, it, describe } from "vitest";
import {
  toolSearchRegex_20251119,
  toolSearchBM25_20251119,
} from "../toolSearch.js";

describe("Anthropic Tool Search Tool Unit Tests", () => {
  describe("toolSearchRegex_20251119", () => {
    it("creates a valid regex tool search definition with no options", () => {
      expect(toolSearchRegex_20251119()).toMatchInlineSnapshot(`
        {
          "cache_control": undefined,
          "name": "tool_search_tool_regex",
          "type": "tool_search_tool_regex_20251119",
        }
      `);
    });

    it("creates a valid regex tool search definition with cache control", () => {
      expect(
        toolSearchRegex_20251119({
          cacheControl: { type: "ephemeral" },
        })
      ).toMatchInlineSnapshot(`
        {
          "cache_control": {
            "type": "ephemeral",
          },
          "name": "tool_search_tool_regex",
          "type": "tool_search_tool_regex_20251119",
        }
      `);
    });
  });

  describe("toolSearchBM25_20251119", () => {
    it("creates a valid BM25 tool search definition with no options", () => {
      expect(toolSearchBM25_20251119()).toMatchInlineSnapshot(`
        {
          "cache_control": undefined,
          "name": "tool_search_tool_bm25",
          "type": "tool_search_tool_bm25_20251119",
        }
      `);
    });

    it("creates a valid BM25 tool search definition with cache control", () => {
      expect(
        toolSearchBM25_20251119({
          cacheControl: { type: "ephemeral" },
        })
      ).toMatchInlineSnapshot(`
        {
          "cache_control": {
            "type": "ephemeral",
          },
          "name": "tool_search_tool_bm25",
          "type": "tool_search_tool_bm25_20251119",
        }
      `);
    });
  });
});
