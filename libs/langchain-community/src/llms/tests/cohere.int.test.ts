import { test } from "@jest/globals";
import { Cohere } from "../cohere.js";

test("Test Cohere", async () => {
  const model = new Cohere({ maxTokens: 20 });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("1 + 1 =");
  // console.log(res);
}, 50000);
