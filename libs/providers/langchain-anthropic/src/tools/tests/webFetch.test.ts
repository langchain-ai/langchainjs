import { expect, it, describe } from "vitest";
import { webFetch_20250910 } from "../webFetch.js";

describe("Anthropic Web Fetch Tool Unit Tests", () => {
  it("webFetch_20250910 creates a valid tool definition with no options", () => {
    expect(webFetch_20250910()).toMatchInlineSnapshot(`
      {
        "allowed_domains": undefined,
        "blocked_domains": undefined,
        "cache_control": undefined,
        "citations": undefined,
        "max_content_tokens": undefined,
        "max_uses": undefined,
        "name": "web_fetch",
        "type": "web_fetch_20250910",
      }
    `);
  });

  it("webFetch_20250910 creates a valid tool definition with all options", () => {
    expect(
      webFetch_20250910({
        maxUses: 5,
        allowedDomains: ["example.com", "docs.example.com"],
        cacheControl: { type: "ephemeral" },
        citations: { enabled: true },
        maxContentTokens: 50000,
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_domains": [
          "example.com",
          "docs.example.com",
        ],
        "blocked_domains": undefined,
        "cache_control": {
          "type": "ephemeral",
        },
        "citations": {
          "enabled": true,
        },
        "max_content_tokens": 50000,
        "max_uses": 5,
        "name": "web_fetch",
        "type": "web_fetch_20250910",
      }
    `);
  });

  it("webFetch_20250910 creates a valid tool definition with blocked domains", () => {
    expect(
      webFetch_20250910({
        maxUses: 10,
        blockedDomains: ["private.example.com", "internal.example.com"],
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_domains": undefined,
        "blocked_domains": [
          "private.example.com",
          "internal.example.com",
        ],
        "cache_control": undefined,
        "citations": undefined,
        "max_content_tokens": undefined,
        "max_uses": 10,
        "name": "web_fetch",
        "type": "web_fetch_20250910",
      }
    `);
  });

  it("webFetch_20250910 creates a valid tool definition with citations disabled", () => {
    expect(
      webFetch_20250910({
        citations: { enabled: false },
      })
    ).toMatchInlineSnapshot(`
      {
        "allowed_domains": undefined,
        "blocked_domains": undefined,
        "cache_control": undefined,
        "citations": {
          "enabled": false,
        },
        "max_content_tokens": undefined,
        "max_uses": undefined,
        "name": "web_fetch",
        "type": "web_fetch_20250910",
      }
    `);
  });
});
