import { test } from "@jest/globals";
import { HuggingFaceInference } from "../hf.js";

test("Test HuggingFace", async () => {
  const model = new HuggingFaceInference();
  const res = await model.call("1 + 1 =");
  console.log(res);
}, 50000);
