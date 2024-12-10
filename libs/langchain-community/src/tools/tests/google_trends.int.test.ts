import { expect, describe } from "@jest/globals";
import { SERPGoogleTrendsTool } from "../google_trends.js";

describe("SERPGoogleTrendsTool", () => {
  test("should be setup with correct parameters", async () => {
    const instance = new SERPGoogleTrendsTool();
    expect(instance.name).toBe("google_trends");
  });

  test("SERPGoogleTrendsTool returns expected result for valid query", async () => {
    const tool = new SERPGoogleTrendsTool();

    const result = await tool._call("Coffee");

    expect(result).toContain("Query: Coffee");
    expect(result).toContain("Date From:");
    expect(result).toContain("Date To:");
    expect(result).toContain("Min Value:");
    expect(result).toContain("Max Value:");
    expect(result).toContain("Average Value:");
    expect(result).toContain("Percent Change:");
    expect(result).toContain("Trend values:");
    expect(result).toContain("Rising Related Queries:");
    expect(result).toContain("Top Related Queries:");
  });

  test("SERPGoogleTrendsTool returns 'No good Trend Result was found' for a non-existent query", async () => {
    const tool = new SERPGoogleTrendsTool();

    const result = await tool._call("earghajgpajrpgjaprgag");

    expect(result).toBe("No good Trend Result was found");
  });
});
