import { jest, expect, describe } from "@jest/globals";
import { GooglePlacesAPI } from "../google_place.js";

jest.mock("node-fetch", () => jest.fn());

jest.mock("../../util/env.js", () => ({
  getEnvironmentVariable: jest.fn().mockImplementation((key) => {
    if (key === "GPLACES_API_KEY") {
      return "test_api_key";
    }
    return null;
  }),
}));

describe("GooglePlacesAPI", () => {
  it("should be setup with correct parameters", async () => {
    const params = {
      apiKey: "test_api_key",
    };

    const instance = new GooglePlacesAPI(params);
    expect(instance.name).toBe("google_places");
  });

  it("should throw an error if missing API key", async () => {
    expect(() => new GooglePlacesAPI({})).toThrow(
      'Google Places API key not set. You can set it as "GPLACES_API_KEY" in your environment variables.'
    );
  });
});

test.skip("GooglePlacesAPI returns expected result for valid query", async () => {
  const tool = new GooglePlacesAPI();

  const result = await tool.call("EatonCenter");

  expect(result).toContain("220 Yonge St");
  expect(result).toContain("CF Toronto Eaton Centre");
});

test.skip("GooglePlacesAPI returns '' for query on an non-existent place", async () => {
  const tool = new GooglePlacesAPI();

  const result = await tool.call("ihfwehnwfi");

  expect(result).toContain("");
});
