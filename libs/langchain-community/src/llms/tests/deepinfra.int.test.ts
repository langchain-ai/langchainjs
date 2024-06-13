import { test } from "@jest/globals";
import { DeepInfraLLM } from "../deepinfra.js";

test("Test DeepInfra", async () => {
  const model = new DeepInfraLLM({ maxTokens: 20 });
  const res = await model.invoke("1 + 1 =");
  console.log(res);
}, 50000);
