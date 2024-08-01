import { test } from "@jest/globals";
import { DeepInfraLLM } from "../deepinfra.js";

test("Test DeepInfra", async () => {
  const model = new DeepInfraLLM({ maxTokens: 20 });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("1 + 1 =");
  // console.log(res);
}, 50000);
