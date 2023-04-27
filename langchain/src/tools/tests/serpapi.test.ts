import { test, expect } from "@jest/globals";
import { SerpAPI } from "../../tools/serpapi.js";

describe("serp api test suite", () => {
  class SerpApiUrlTester extends SerpAPI {
    testThisUrl(): string {
      return this.buildUrl("search", this.params, this.baseUrl);
    }
  }

  test("Test default url", async () => {
    const serpApi = new SerpApiUrlTester(
      "Not a real key but constructor error if not set",
      {
        hl: "en",
        gl: "us",
      }
    );
    expect(serpApi.testThisUrl()).toEqual(
      "https://serpapi.com/search?hl=en&gl=us"
    );
  });

  test("Test override url", async () => {
    const serpApiProxied = new SerpApiUrlTester(
      "Not a real key but constructor error if not set",
      {
        gl: "us",
      },
      "https://totallyProxied.com"
    );

    expect(
      serpApiProxied.testThisUrl() === "https://totallyProxied.com/search?gl=us"
    );
  });
});
