import { test, expect } from "@jest/globals";
import { preprocessJsonInput } from "../output_parser.js";

test("should parse outputs correctly", () => {
  expect(preprocessJsonInput("{'escaped':'\\a'}")).toBe("{'escaped':'\\\\a'}");

  expect(preprocessJsonInput("```\n{}\n```")).toBe("{}");
  expect(preprocessJsonInput("```json\n{}\n```")).toBe("{}");
  expect(
    preprocessJsonInput("I will do the following:\n\n```json\n{}\n```")
  ).toBe("{}");
});
