import { expect, describe } from "@jest/globals";
import { GoogleFinanceAPI } from "../google_finance.js";

describe("GoogleFinanceAPI", () => {
  test("should be setup with correct parameters", async () => {
    const instance = new GoogleFinanceAPI();
    expect(instance.name).toBe("google_finance");
  });

  test("GoogleFinanceAPI returns expected result for valid query", async () => {
    const tool = new GoogleFinanceAPI();

    const result = await tool.invoke("GOOG:NASDAQ");

    expect(result).toContain("Alphabet Inc.");
    expect(result).toContain("GOOG");
    expect(result).toContain("NASDAQ");
  });

  test("GoogleFinanceAPI returns '' for query on a non-existent ticker symbol", async () => {
    const tool = new GoogleFinanceAPI();

    const result = await tool.invoke("mkvdfmvkdmvkdovkam");

    expect(result).toContain("");
  });
});
