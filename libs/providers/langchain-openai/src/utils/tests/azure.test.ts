import { describe, expect, test } from "vitest";
import { getHeadersWithUserAgent, getFormattedEnv } from "../azure.js";

const libraryUserAgent = (isAzure = false, version = "1.0.0") =>
  `langchainjs${isAzure ? "-azure" : ""}-openai/${version} (${getFormattedEnv()})`;

describe("getHeadersWithUserAgent", () => {
  test("sets the library user agent when the caller supplies none", () => {
    const headers = getHeadersWithUserAgent({});

    expect(headers["User-Agent"]).toBe(libraryUserAgent());
  });

  test("uses the azure library name and the given version", () => {
    const headers = getHeadersWithUserAgent({}, true, "2.3.4");

    expect(headers["User-Agent"]).toBe(libraryUserAgent(true, "2.3.4"));
  });

  test("appends a caller user agent after the library one, space separated", () => {
    const headers = getHeadersWithUserAgent({ "User-Agent": "my-app/1.2" });

    expect(headers["User-Agent"]).toBe(`${libraryUserAgent()} my-app/1.2`);
  });

  test("matches a caller user agent whatever its casing", () => {
    for (const name of ["User-Agent", "user-agent", "USER-AGENT"]) {
      const headers = getHeadersWithUserAgent({ [name]: "my-app/1.2" });

      expect(headers["User-Agent"]).toBe(`${libraryUserAgent()} my-app/1.2`);
    }
  });

  test("emits exactly one user-agent entry, so a transport does not comma-join two", () => {
    const headers = getHeadersWithUserAgent({ "User-Agent": "my-app/1.2" });

    const userAgentKeys = Object.keys(headers).filter(
      (key) => key.toLowerCase() === "user-agent"
    );
    expect(userAgentKeys).toEqual(["User-Agent"]);

    expect(new Headers(headers).get("user-agent")).toBe(
      `${libraryUserAgent()} my-app/1.2`
    );
  });

  test("preserves other headers", () => {
    const headers = getHeadersWithUserAgent({
      "Content-Type": "application/json",
      "X-Custom": "value",
    });

    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-custom"]).toBe("value");
  });

  test("accepts a Headers instance", () => {
    const headers = getHeadersWithUserAgent(
      new Headers({ "User-Agent": "my-app/1.2" })
    );

    expect(headers["User-Agent"]).toBe(`${libraryUserAgent()} my-app/1.2`);
  });

  test("accepts an array of header pairs", () => {
    const headers = getHeadersWithUserAgent([["user-agent", "my-app/1.2"]]);

    expect(headers["User-Agent"]).toBe(`${libraryUserAgent()} my-app/1.2`);
  });

  test("ignores an empty caller user agent", () => {
    const headers = getHeadersWithUserAgent({ "User-Agent": "" });

    expect(headers["User-Agent"]).toBe(libraryUserAgent());
  });
});
