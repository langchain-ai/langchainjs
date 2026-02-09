import { test, expect, describe } from "vitest";
import {
  XAI_COLLECTIONS_SEARCH_TOOL_TYPE,
  xaiCollectionsSearch,
  XAICollectionsSearchTool,
} from "../collections_search.js";

describe("xaiCollectionsSearch tool", () => {
  test("creates a tool with correct type", () => {
    const tool = xaiCollectionsSearch();

    expect(tool).toMatchObject({
      type: XAI_COLLECTIONS_SEARCH_TOOL_TYPE,
    } satisfies XAICollectionsSearchTool);
  });

  test("creates a tool with default options (empty)", () => {
    const tool = xaiCollectionsSearch();

    expect(tool.type).toBe("file_search");
    expect(tool.vector_store_ids).toBeUndefined();
  });

  test("creates a tool with vectorStoreIds option", () => {
    const tool = xaiCollectionsSearch({
      vectorStoreIds: ["collection_abc123", "collection_def456"],
    });

    expect(tool).toMatchObject({
      type: XAI_COLLECTIONS_SEARCH_TOOL_TYPE,
      vector_store_ids: ["collection_abc123", "collection_def456"],
    } satisfies XAICollectionsSearchTool);
  });

  test("creates a tool with single vectorStoreId", () => {
    const tool = xaiCollectionsSearch({
      vectorStoreIds: ["collection_single"],
    });

    expect(tool).toMatchObject({
      type: XAI_COLLECTIONS_SEARCH_TOOL_TYPE,
      vector_store_ids: ["collection_single"],
    } satisfies XAICollectionsSearchTool);
  });

  test("converts camelCase options to snake_case", () => {
    const tool = xaiCollectionsSearch({
      vectorStoreIds: ["test_collection"],
    });

    // Verify snake_case keys in the output
    expect("vector_store_ids" in tool).toBe(true);

    // Verify camelCase keys are NOT in the output
    expect("vectorStoreIds" in tool).toBe(false);
  });

  test("empty vectorStoreIds array is preserved", () => {
    const tool = xaiCollectionsSearch({
      vectorStoreIds: [],
    });

    expect(tool.vector_store_ids).toEqual([]);
  });
});
