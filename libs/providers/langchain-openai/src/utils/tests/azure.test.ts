import { test, expect, describe } from "vitest";
import { getHeadersWithUserAgent, normalizeHeaders } from "../azure.js";

const LIBRARY_UA = /^langchainjs-openai\/1\.0\.0 \(.+\)$/;

/**
 * Collapse a header record the way a transport does, so duplicate-cased keys
 * surface as a single comma-joined value.
 */
function asTransportUserAgent(headers: Record<string, string>) {
  return new Headers(headers).get("user-agent");
}

describe("getHeadersWithUserAgent", () => {
  test("sets the library user agent when the caller supplies none", () => {
    const headers = getHeadersWithUserAgent(undefined);

    expect(headers["User-Agent"]).toMatch(LIBRARY_UA);
  });

  test("uses the azure library name when isAzure is set", () => {
    const headers = getHeadersWithUserAgent(undefined, true);

    expect(headers["User-Agent"]).toMatch(
      /^langchainjs-azure-openai\/1\.0\.0 /
    );
  });

  test("preserves unrelated headers", () => {
    const headers = getHeadersWithUserAgent({ "X-Custom": "value" });

    expect(headers["x-custom"]).toBe("value");
  });

  test("appends a caller user agent after the library one, space separated", () => {
    const headers = getHeadersWithUserAgent({ "User-Agent": "my-app/1.2" });

    expect(headers["User-Agent"]).toMatch(
      /^langchainjs-openai\/1\.0\.0 \(.+\) my-app\/1\.2$/
    );
  });

  test("emits exactly one user agent key regardless of caller casing", () => {
    for (const name of ["User-Agent", "user-agent", "USER-AGENT"]) {
      const headers = getHeadersWithUserAgent({ [name]: "my-app/1.2" });

      const userAgentKeys = Object.keys(headers).filter(
        (key) => key.toLowerCase() === "user-agent"
      );

      expect(userAgentKeys).toEqual(["User-Agent"]);
      expect(headers["User-Agent"]).toContain("my-app/1.2");
    }
  });

  test("does not produce a comma-joined user agent at the transport", () => {
    const headers = getHeadersWithUserAgent({ "User-Agent": "my-app/1.2" });

    expect(asTransportUserAgent(headers)).not.toContain(",");
  });

  test("handles a Headers instance", () => {
    const headers = getHeadersWithUserAgent(
      new Headers([["User-Agent", "my-app/1.2"]])
    );

    expect(headers["User-Agent"]).toMatch(
      /^langchainjs-openai\/1\.0\.0 \(.+\) my-app\/1\.2$/
    );
  });

  test("handles an array of header pairs", () => {
    const headers = getHeadersWithUserAgent([["User-Agent", "my-app/1.2"]]);

    expect(headers["User-Agent"]).toMatch(
      /^langchainjs-openai\/1\.0\.0 \(.+\) my-app\/1\.2$/
    );
  });
});

describe("normalizeHeaders", () => {
  test("lowercases header names", () => {
    expect(normalizeHeaders({ "User-Agent": "my-app/1.2" })).toEqual({
      "user-agent": "my-app/1.2",
    });
  });
});
