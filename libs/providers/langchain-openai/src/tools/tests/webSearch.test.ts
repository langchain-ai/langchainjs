import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Web Search Tool Tests", () => {
  it("webSearch creates a basic valid tool definition", () => {
    expect(tools.webSearch()).toMatchInlineSnapshot(`
      {
        "filters": undefined,
        "search_context_size": undefined,
        "type": "web_search",
        "user_location": undefined,
      }
    `);
  });

  it("webSearch creates tool with domain filtering", () => {
    expect(
      tools.webSearch({
        filters: {
          allowedDomains: ["openai.com", "arxiv.org", "nature.com"],
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": {
          "allowed_domains": [
            "openai.com",
            "arxiv.org",
            "nature.com",
          ],
        },
        "search_context_size": undefined,
        "type": "web_search",
        "user_location": undefined,
      }
    `);
  });

  it("webSearch creates tool with user location", () => {
    expect(
      tools.webSearch({
        userLocation: {
          type: "approximate",
          country: "US",
          city: "San Francisco",
          region: "California",
          timezone: "America/Los_Angeles",
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "filters": undefined,
        "search_context_size": undefined,
        "type": "web_search",
        "user_location": {
          "city": "San Francisco",
          "country": "US",
          "region": "California",
          "timezone": "America/Los_Angeles",
          "type": "approximate",
        },
      }
    `);
  });
});
