import { test, expect } from "@jest/globals";
import { GraphQLClientTool } from "../graphql.js";

describe("GraphQL Test Suite", () => {
  test("make a graphql query", async () => {
    const tool = new GraphQLClientTool({
      endpoint: "https://countries.trevorblades.com",
    });

    const response = await tool._call({
      query: `
        query {
          country(code: "DE") {
            code
          }
        }`,
    });

    expect(JSON.parse(response).data).toEqual({
      country: {
        code: "DE",
      },
    });
  });
});
