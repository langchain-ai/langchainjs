import { expect, describe } from "@jest/globals";
import { GooglePlacesAPI } from "../google_places.js";

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

test("GooglePlacesAPI returns expected result for valid query", async () => {
  const tool = new GooglePlacesAPI();

  const result = await tool.call("EatonCenter");

  expect(result).toContain("220 Yonge St");
  expect(result).toContain("CF Toronto Eaton Centre");
});

test("GooglePlacesAPI returns '' for query on an non-existent place", async () => {
  const tool = new GooglePlacesAPI();

  const result = await tool.call("ihfwehnwfi");

  expect(result).toContain("");
});
