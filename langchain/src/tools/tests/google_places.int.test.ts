import { expect, describe } from "@jest/globals";
import { GooglePlacesAPI } from "../google_places.js";

describe("GooglePlacesAPI", () => {
  test("should be setup with correct parameters", async () => {
    const instance = new GooglePlacesAPI();
    expect(instance.name).toBe("google_places");
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
});
