import { describe, test } from "@jest/globals";
import { HumanTool } from "../human.js";

describe("Human as a tool unit test suite", () => {
  test("HumanTool call", async () => {
    const input = "Sure, what is the quote you are trying to attribute?";

    const tool = new HumanTool();

    const result = await tool.call(input);

    expect(result).toEqual(input);
  });
});
