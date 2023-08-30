/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { getEnvironmentVariable } from "../../util/env.js";
import { LlamaCpp } from "../llama_cpp.js";

const llamaPath = getEnvironmentVariable("LLAMA_PATH")!;

test.skip("Test Llama_CPP", async () => {
  const model = new LlamaCpp({ modelPath: llamaPath });
  const res = await model.call("Where do Llamas live?");
  console.log(res);
}, 100000);

test.skip("Test Llama_CPP", async () => {
  const model = new LlamaCpp({ modelPath: llamaPath });
  const res = await model.call("Where do Pandas live?");
  console.log(res);
}, 100000);
