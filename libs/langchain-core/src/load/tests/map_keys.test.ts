import { describe, expect, test } from "vitest";
import { keyFromJson, keyToJson, mapKeys } from "../map_keys.js";

describe("map_keys", () => {
  test("converts camelCase keys to snake_case", () => {
    expect(keyToJson("myKey")).toBe("my_key");
    expect(keyToJson("HTTPResponseCode")).toBe("http_response_code");
  });

  test("converts snake_case keys back to camelCase", () => {
    expect(keyFromJson("my_key")).toBe("myKey");
    expect(keyFromJson("http_response_code")).toBe("httpResponseCode");
    expect(keyFromJson("alreadyCamel")).toBe("alreadyCamel");
  });

  test("maps keys using aliases when provided", () => {
    expect(keyToJson("apiKey", { apiKey: "api_token" })).toBe("api_token");
    expect(keyFromJson("api_token", { api_token: "apiKey" })).toBe("apiKey");
  });

  test("maps object keys while preserving values", () => {
    const input = { firstName: "Ada", lastName: "Lovelace", age: 36 };
    expect(mapKeys(input, keyToJson)).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      age: 36,
    });
  });
});
