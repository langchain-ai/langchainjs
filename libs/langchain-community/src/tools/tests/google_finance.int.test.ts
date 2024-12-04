import { expect, describe } from "@jest/globals";
import { SERPGoogleFinanceAPITool } from "../google_finance.js";

describe("SERPGoogleFinanceAPITool", () => {
  test("should be setup with correct parameters", async () => {
    const instance = new SERPGoogleFinanceAPITool();
    expect(instance.name).toBe("google_finance");
  });

  test("SERPGoogleFinanceAPITool returns expected result for valid query", async () => {
    const tool = new SERPGoogleFinanceAPITool();

    const result = await tool.invoke("GOOG:NASDAQ");

    expect(result).toContain("Alphabet Inc.");
    expect(result).toContain("GOOG");
    expect(result).toContain("NASDAQ");
  });

  test("SERPGoogleFinanceAPITool returns '' for query on a non-existent ticker symbol", async () => {
    const tool = new SERPGoogleFinanceAPITool();

    const result = await tool.invoke("mkvdfmvkdmvkdovkam");

    expect(result).toContain("");
  });
});
