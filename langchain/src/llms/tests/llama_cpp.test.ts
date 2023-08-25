import { test } from "@jest/globals";
import { getEnvironmentVariable } from "../../util/env.js";
import { LlamaCpp } from "../llama_cpp.js";

let llamaPath = getEnvironmentVariable("LLAMA_PATH");

test("Test Llama_CPP", async () => {
  const model = new LlamaCpp({modelPath: <string>llamaPath});
  const res = await model.call("Where do koala bears live?");
  console.log(res);
}, 50000);

test("Test Llama_CPP", async () => {
  const model = new LlamaCpp({modelPath: <string>llamaPath});
  const res = await model.call("Where do panda bears live?");
  console.log(res);
}, 50000);
