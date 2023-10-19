import { test, expect } from "@jest/globals";
import { SearchApi } from "../../tools/searchapi.js";

describe("SearchApi test suite", () => {
  class SearchApiUrlTester extends SearchApi {
    testThisUrl(): string {
      return this.buildUrl("Query");
    }
  }

  test("Test default url", async () => {
    const searchApi = new SearchApiUrlTester("ApiKey", {
      hl: "en",
      gl: "us",
    });
    expect(searchApi.testThisUrl()).toEqual(
      "https://www.searchapi.io/api/v1/search?engine=google&api_key=ApiKey&hl=en&gl=us&q=Query"
    );
  });
});
