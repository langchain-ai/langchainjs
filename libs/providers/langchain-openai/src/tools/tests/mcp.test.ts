import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI MCP Tool Tests", () => {
  it("mcp creates a basic remote server tool definition", () => {
    expect(
      tools.mcp({
        serverLabel: "dmcp",
        serverUrl: "https://dmcp-server.deno.dev/sse",
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": undefined,
        "authorization": undefined,
        "headers": undefined,
        "require_approval": undefined,
        "server_description": undefined,
        "server_label": "dmcp",
        "server_url": "https://dmcp-server.deno.dev/sse",
        "type": "mcp",
      }
    `);
  });

  it("mcp creates a connector tool definition", () => {
    expect(
      tools.mcp({
        serverLabel: "google_calendar",
        connectorId: "connector_googlecalendar",
        authorization: "test-oauth-token",
        requireApproval: "never",
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": undefined,
        "authorization": "test-oauth-token",
        "connector_id": "connector_googlecalendar",
        "headers": undefined,
        "require_approval": "never",
        "server_description": undefined,
        "server_label": "google_calendar",
        "type": "mcp",
      }
    `);
  });

  it("mcp creates tool with server description", () => {
    expect(
      tools.mcp({
        serverLabel: "dmcp",
        serverUrl: "https://dmcp-server.deno.dev/sse",
        serverDescription: "A D&D MCP server for dice rolling",
        requireApproval: "never",
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": undefined,
        "authorization": undefined,
        "headers": undefined,
        "require_approval": "never",
        "server_description": "A D&D MCP server for dice rolling",
        "server_label": "dmcp",
        "server_url": "https://dmcp-server.deno.dev/sse",
        "type": "mcp",
      }
    `);
  });

  it("mcp creates tool with allowed tools array", () => {
    expect(
      tools.mcp({
        serverLabel: "dmcp",
        serverUrl: "https://dmcp-server.deno.dev/sse",
        allowedTools: ["roll", "flip_coin"],
        requireApproval: "never",
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": [
          "roll",
          "flip_coin",
        ],
        "authorization": undefined,
        "headers": undefined,
        "require_approval": "never",
        "server_description": undefined,
        "server_label": "dmcp",
        "server_url": "https://dmcp-server.deno.dev/sse",
        "type": "mcp",
      }
    `);
  });

  it("mcp creates tool with allowed tools filter object", () => {
    expect(
      tools.mcp({
        serverLabel: "dmcp",
        serverUrl: "https://dmcp-server.deno.dev/sse",
        allowedTools: {
          toolNames: ["roll"],
          readOnly: true,
        },
        requireApproval: "never",
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": {
          "read_only": true,
          "tool_names": [
            "roll",
          ],
        },
        "authorization": undefined,
        "headers": undefined,
        "require_approval": "never",
        "server_description": undefined,
        "server_label": "dmcp",
        "server_url": "https://dmcp-server.deno.dev/sse",
        "type": "mcp",
      }
    `);
  });

  it("mcp creates tool with fine-grained approval control", () => {
    expect(
      tools.mcp({
        serverLabel: "deepwiki",
        serverUrl: "https://mcp.deepwiki.com/mcp",
        requireApproval: {
          never: { toolNames: ["ask_question", "read_wiki_structure"] },
          always: { toolNames: ["modify_content"] },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": undefined,
        "authorization": undefined,
        "headers": undefined,
        "require_approval": {
          "always": {
            "read_only": undefined,
            "tool_names": [
              "modify_content",
            ],
          },
          "never": {
            "read_only": undefined,
            "tool_names": [
              "ask_question",
              "read_wiki_structure",
            ],
          },
        },
        "server_description": undefined,
        "server_label": "deepwiki",
        "server_url": "https://mcp.deepwiki.com/mcp",
        "type": "mcp",
      }
    `);
  });

  it("mcp creates tool with custom headers", () => {
    expect(
      tools.mcp({
        serverLabel: "custom",
        serverUrl: "https://custom-mcp.example.com",
        headers: {
          "X-Custom-Header": "custom-value",
          "X-Another-Header": "another-value",
        },
        requireApproval: "never",
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": undefined,
        "authorization": undefined,
        "headers": {
          "X-Another-Header": "another-value",
          "X-Custom-Header": "custom-value",
        },
        "require_approval": "never",
        "server_description": undefined,
        "server_label": "custom",
        "server_url": "https://custom-mcp.example.com",
        "type": "mcp",
      }
    `);
  });

  it("mcp creates tool with all connector options", () => {
    expect(
      tools.mcp({
        serverLabel: "Dropbox",
        connectorId: "connector_dropbox",
        authorization: "dropbox-oauth-token",
        allowedTools: ["search", "fetch"],
        requireApproval: "always",
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_tools": [
          "search",
          "fetch",
        ],
        "authorization": "dropbox-oauth-token",
        "connector_id": "connector_dropbox",
        "headers": undefined,
        "require_approval": "always",
        "server_description": undefined,
        "server_label": "Dropbox",
        "type": "mcp",
      }
    `);
  });
});
