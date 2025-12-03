import { expect, it, describe } from "vitest";
import { mcpToolset_20251120 } from "../mcpToolset.js";

describe("Anthropic MCP Toolset Tests", () => {
  it("mcpToolset_20251120 creates a basic valid tool definition", () => {
    expect(mcpToolset_20251120({ serverName: "example-mcp" }))
      .toMatchInlineSnapshot(`
      {
        "cache_control": undefined,
        "configs": undefined,
        "default_config": undefined,
        "mcp_server_name": "example-mcp",
        "type": "mcp_toolset",
      }
    `);
  });

  it("mcpToolset_20251120 creates allowlist pattern", () => {
    expect(
      mcpToolset_20251120({
        serverName: "google-calendar-mcp",
        defaultConfig: { enabled: false },
        configs: {
          search_events: { enabled: true },
          create_event: { enabled: true },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "cache_control": undefined,
        "configs": {
          "create_event": {
            "defer_loading": undefined,
            "enabled": true,
          },
          "search_events": {
            "defer_loading": undefined,
            "enabled": true,
          },
        },
        "default_config": {
          "defer_loading": undefined,
          "enabled": false,
        },
        "mcp_server_name": "google-calendar-mcp",
        "type": "mcp_toolset",
      }
    `);
  });

  it("mcpToolset_20251120 creates denylist pattern", () => {
    expect(
      mcpToolset_20251120({
        serverName: "google-calendar-mcp",
        configs: {
          delete_all_events: { enabled: false },
          share_calendar_publicly: { enabled: false },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "cache_control": undefined,
        "configs": {
          "delete_all_events": {
            "defer_loading": undefined,
            "enabled": false,
          },
          "share_calendar_publicly": {
            "defer_loading": undefined,
            "enabled": false,
          },
        },
        "default_config": undefined,
        "mcp_server_name": "google-calendar-mcp",
        "type": "mcp_toolset",
      }
    `);
  });

  it("mcpToolset_20251120 supports deferred loading for tool search", () => {
    expect(
      mcpToolset_20251120({
        serverName: "example-mcp",
        defaultConfig: { deferLoading: true },
      })
    ).toMatchInlineSnapshot(`
      {
        "cache_control": undefined,
        "configs": undefined,
        "default_config": {
          "defer_loading": true,
          "enabled": undefined,
        },
        "mcp_server_name": "example-mcp",
        "type": "mcp_toolset",
      }
    `);
  });

  it("mcpToolset_20251120 supports mixed allowlist with per-tool configuration", () => {
    expect(
      mcpToolset_20251120({
        serverName: "google-calendar-mcp",
        defaultConfig: { enabled: false, deferLoading: true },
        configs: {
          search_events: { enabled: true, deferLoading: false },
          list_events: { enabled: true },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "cache_control": undefined,
        "configs": {
          "list_events": {
            "defer_loading": undefined,
            "enabled": true,
          },
          "search_events": {
            "defer_loading": false,
            "enabled": true,
          },
        },
        "default_config": {
          "defer_loading": true,
          "enabled": false,
        },
        "mcp_server_name": "google-calendar-mcp",
        "type": "mcp_toolset",
      }
    `);
  });

  it("mcpToolset_20251120 supports cache control", () => {
    expect(
      mcpToolset_20251120({
        serverName: "example-mcp",
        cacheControl: { type: "ephemeral" },
      })
    ).toMatchInlineSnapshot(`
      {
        "cache_control": {
          "type": "ephemeral",
        },
        "configs": undefined,
        "default_config": undefined,
        "mcp_server_name": "example-mcp",
        "type": "mcp_toolset",
      }
    `);
  });
});
