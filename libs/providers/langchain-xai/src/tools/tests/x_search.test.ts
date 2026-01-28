import { test, expect, describe } from "vitest";
import {
  XAI_X_SEARCH_TOOL_TYPE,
  xaiXSearch,
  XAIXSearchTool,
} from "../x_search.js";

describe("xaiXSearch tool", () => {
  test("creates a tool with correct type", () => {
    const tool = xaiXSearch();

    expect(tool).toMatchObject({
      type: XAI_X_SEARCH_TOOL_TYPE,
    } satisfies XAIXSearchTool);
  });

  test("creates a tool with default options (empty)", () => {
    const tool = xaiXSearch();

    expect(tool.type).toBe("x_search");
    expect(tool.allowed_x_handles).toBeUndefined();
    expect(tool.excluded_x_handles).toBeUndefined();
    expect(tool.from_date).toBeUndefined();
    expect(tool.to_date).toBeUndefined();
    expect(tool.enable_image_understanding).toBeUndefined();
    expect(tool.enable_video_understanding).toBeUndefined();
  });

  test("creates a tool with allowedXHandles option", () => {
    const tool = xaiXSearch({
      allowedXHandles: ["elonmusk", "xai"],
    });

    expect(tool).toMatchObject({
      type: XAI_X_SEARCH_TOOL_TYPE,
      allowed_x_handles: ["elonmusk", "xai"],
    } satisfies XAIXSearchTool);
  });

  test("creates a tool with excludedXHandles option", () => {
    const tool = xaiXSearch({
      excludedXHandles: ["spamaccount"],
    });

    expect(tool).toMatchObject({
      type: XAI_X_SEARCH_TOOL_TYPE,
      excluded_x_handles: ["spamaccount"],
    } satisfies XAIXSearchTool);
  });

  test("creates a tool with date range options", () => {
    const tool = xaiXSearch({
      fromDate: "2024-01-01",
      toDate: "2024-12-31",
    });

    expect(tool).toMatchObject({
      type: XAI_X_SEARCH_TOOL_TYPE,
      from_date: "2024-01-01",
      to_date: "2024-12-31",
    } satisfies XAIXSearchTool);
  });

  test("creates a tool with image understanding option", () => {
    const tool = xaiXSearch({
      enableImageUnderstanding: true,
    });

    expect(tool).toMatchObject({
      type: XAI_X_SEARCH_TOOL_TYPE,
      enable_image_understanding: true,
    } satisfies XAIXSearchTool);
  });

  test("creates a tool with video understanding option", () => {
    const tool = xaiXSearch({
      enableVideoUnderstanding: true,
    });

    expect(tool).toMatchObject({
      type: XAI_X_SEARCH_TOOL_TYPE,
      enable_video_understanding: true,
    } satisfies XAIXSearchTool);
  });

  test("creates a tool with all options", () => {
    const tool = xaiXSearch({
      allowedXHandles: ["elonmusk"],
      fromDate: "2024-10-01",
      toDate: "2024-10-31",
      enableImageUnderstanding: true,
      enableVideoUnderstanding: true,
    });

    expect(tool).toMatchObject({
      type: XAI_X_SEARCH_TOOL_TYPE,
      allowed_x_handles: ["elonmusk"],
      from_date: "2024-10-01",
      to_date: "2024-10-31",
      enable_image_understanding: true,
      enable_video_understanding: true,
    } satisfies XAIXSearchTool);
  });

  test("converts camelCase options to snake_case", () => {
    const tool = xaiXSearch({
      allowedXHandles: ["test"],
      excludedXHandles: ["spam"],
      fromDate: "2024-01-01",
      toDate: "2024-12-31",
      enableImageUnderstanding: true,
      enableVideoUnderstanding: false,
    });

    // Verify snake_case keys in the output
    expect("allowed_x_handles" in tool).toBe(true);
    expect("excluded_x_handles" in tool).toBe(true);
    expect("from_date" in tool).toBe(true);
    expect("to_date" in tool).toBe(true);
    expect("enable_image_understanding" in tool).toBe(true);
    expect("enable_video_understanding" in tool).toBe(true);

    // Verify camelCase keys are NOT in the output
    expect("allowedXHandles" in tool).toBe(false);
    expect("excludedXHandles" in tool).toBe(false);
    expect("fromDate" in tool).toBe(false);
    expect("toDate" in tool).toBe(false);
    expect("enableImageUnderstanding" in tool).toBe(false);
    expect("enableVideoUnderstanding" in tool).toBe(false);
  });
});
