import { test } from "@jest/globals";
import { Cohere } from "../cohere";

test("Test Cohere", async () => {
  const model = new Cohere({ maxTokens: 20 });
  const res = await model.call("1 + 1 =");
  console.log(res);
}, 50000);
