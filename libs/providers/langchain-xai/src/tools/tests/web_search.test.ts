import { test, expect, describe } from "vitest";
import {
  XAI_WEB_SEARCH_TOOL_TYPE,
  xaiWebSearch,
  XAIWebSearchTool,
} from "../web_search.js";

describe("xaiWebSearch tool", () => {
  test("creates a tool with correct type", () => {
    const tool = xaiWebSearch();

    expect(tool).toMatchObject({
      type: XAI_WEB_SEARCH_TOOL_TYPE,
    } satisfies XAIWebSearchTool);
  });

  test("creates a tool with default options (empty)", () => {
    const tool = xaiWebSearch();

    expect(tool.type).toBe("web_search");
    expect(tool.allowed_domains).toBeUndefined();
    expect(tool.excluded_domains).toBeUndefined();
    expect(tool.enable_image_understanding).toBeUndefined();
  });

  test("creates a tool with allowedDomains option", () => {
    const tool = xaiWebSearch({
      allowedDomains: ["wikipedia.org", "github.com"],
    });

    expect(tool).toMatchObject({
      type: XAI_WEB_SEARCH_TOOL_TYPE,
      allowed_domains: ["wikipedia.org", "github.com"],
    } satisfies XAIWebSearchTool);
  });

  test("creates a tool with excludedDomains option", () => {
    const tool = xaiWebSearch({
      excludedDomains: ["example.com", "spam.net"],
    });

    expect(tool).toMatchObject({
      type: XAI_WEB_SEARCH_TOOL_TYPE,
      excluded_domains: ["example.com", "spam.net"],
    } satisfies XAIWebSearchTool);
  });

  test("creates a tool with enableImageUnderstanding option", () => {
    const tool = xaiWebSearch({
      enableImageUnderstanding: true,
    });

    expect(tool).toMatchObject({
      type: XAI_WEB_SEARCH_TOOL_TYPE,
      enable_image_understanding: true,
    } satisfies XAIWebSearchTool);
  });

  test("creates a tool with all options", () => {
    const tool = xaiWebSearch({
      allowedDomains: ["example.com"],
      enableImageUnderstanding: true,
    });

    expect(tool).toMatchObject({
      type: XAI_WEB_SEARCH_TOOL_TYPE,
      allowed_domains: ["example.com"],
      enable_image_understanding: true,
    } satisfies XAIWebSearchTool);
  });

  test("converts camelCase options to snake_case", () => {
    const tool = xaiWebSearch({
      allowedDomains: ["test.com"],
      excludedDomains: ["bad.com"],
      enableImageUnderstanding: false,
    });

    // Verify snake_case keys in the output
    expect("allowed_domains" in tool).toBe(true);
    expect("excluded_domains" in tool).toBe(true);
    expect("enable_image_understanding" in tool).toBe(true);

    // Verify camelCase keys are NOT in the output
    expect("allowedDomains" in tool).toBe(false);
    expect("excludedDomains" in tool).toBe(false);
    expect("enableImageUnderstanding" in tool).toBe(false);
  });
});
