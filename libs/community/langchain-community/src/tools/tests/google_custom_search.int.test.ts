import { test } from "@jest/globals";
import { GoogleCustomSearch } from "../google_custom_search.js";

test.skip("GoogleCustomSearchTool", async () => {
  const tool = new GoogleCustomSearch();

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await tool.invoke("What is Langchain?");

  // console.log({ result });
});
