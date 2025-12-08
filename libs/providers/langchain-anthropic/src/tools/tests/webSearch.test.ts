import { expect, it, describe } from "vitest";
import { webSearch_20250305 } from "../webSearch.js";

describe("Anthropic Web Search Tool Integration Tests", () => {
  it("webSearch_20250305 creates a valid tool definition", () => {
    expect(webSearch_20250305()).toMatchInlineSnapshot(`
      {
        "allowed_domains": undefined,
        "blocked_domains": undefined,
        "cache_control": undefined,
        "defer_loading": undefined,
        "max_uses": undefined,
        "name": "web_search",
        "strict": undefined,
        "type": "web_search_20250305",
        "user_location": undefined,
      }
    `);

    expect(
      webSearch_20250305({
        maxUses: 3,
        allowedDomains: ["example.com", "docs.example.com"],
        cacheControl: { type: "ephemeral" },
        deferLoading: true,
        strict: true,
        userLocation: {
          type: "approximate",
          country: "US",
          region: "California",
          city: "San Francisco",
        },
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
        "defer_loading": true,
        "max_uses": 3,
        "name": "web_search",
        "strict": true,
        "type": "web_search_20250305",
        "user_location": {
          "city": "San Francisco",
          "country": "US",
          "region": "California",
          "type": "approximate",
        },
      }
    `);
  });
});
