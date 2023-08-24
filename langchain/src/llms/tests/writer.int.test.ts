import { test } from "@jest/globals";
import { Writer } from "../writer.js";

test("Test Writer", async () => {
  const model = new Writer({ maxTokens: 20 });
  const res = await model.call("1 + 1 =");
  console.log(res);
}, 50000);
