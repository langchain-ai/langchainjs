import { test } from "@jest/globals";
import { BraveSearch } from "../brave_search.js";

test.skip("BraveSearchTool", async () => {
  const tool = new BraveSearch();

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await tool.invoke("What is Langchain?");

  // console.log({ result });
});
