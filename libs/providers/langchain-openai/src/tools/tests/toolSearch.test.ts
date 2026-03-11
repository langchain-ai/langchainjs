import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Tool Search Tool Tests", () => {
  it("toolSearch creates a basic server-executed tool definition", () => {
    expect(tools.toolSearch()).toMatchInlineSnapshot(`
      {
        "type": "tool_search",
      }
    `);
  });

  it("toolSearch creates a server-executed tool with explicit execution", () => {
    expect(tools.toolSearch({ execution: "server" })).toMatchInlineSnapshot(`
      {
        "execution": "server",
        "type": "tool_search",
      }
    `);
  });

  it("toolSearch creates a client-executed tool with description and parameters", () => {
    expect(
      tools.toolSearch({
        execution: "client",
        description: "Search for available tools by goal",
        parameters: {
          type: "object",
          properties: {
            goal: {
              type: "string",
              description: "The goal to search tools for",
            },
          },
          required: ["goal"],
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "description": "Search for available tools by goal",
        "execution": "client",
        "parameters": {
          "properties": {
            "goal": {
              "description": "The goal to search tools for",
              "type": "string",
            },
          },
          "required": [
            "goal",
          ],
          "type": "object",
        },
        "type": "tool_search",
      }
    `);
  });
});
