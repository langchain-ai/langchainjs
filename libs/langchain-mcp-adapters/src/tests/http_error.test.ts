import { describe, expect, it } from "vitest";
import { getHttpErrorStatus } from "../http_error.js";

describe("HTTP error status parsing", () => {
  it.each([
    [{ status: 401, code: "HTTP_ERROR" }, 401],
    [{ code: 405 }, 405],
    [{ status: 403, code: 404 }, 403],
    [new Error("Connection failed (HTTP 404)"), 404],
    [{ code: "HTTP_ERROR", message: "Failed (HTTP 502)" }, 502],
    [null, undefined],
    [undefined, undefined],
    ["failed", undefined],
    [{ code: "404" }, undefined],
    [{ code: -32000 }, undefined],
    [{ status: 600 }, undefined],
    [{ status: 401.5 }, undefined],
    [{ message: 404 }, undefined],
    [new Error("Failed (HTTP 999)"), undefined],
  ])("parses %j as %s", (error, expected) => {
    expect(getHttpErrorStatus(error)).toBe(expected);
  });
});
