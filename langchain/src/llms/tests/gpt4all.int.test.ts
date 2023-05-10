import { test, expect } from "@jest/globals";
import { GPT4All } from "../gpt4all.js";

// GPT4All will likely need to download the model, which may take a couple mins
test(
  "Test GPT4All",
  async () => {
    const startTime = performance.now();
    const model = new GPT4All({
      model: "gpt4all-lora-quantized",
    });
    const endTime = performance.now();
    const timeElapsed = endTime - startTime;
    console.log(`GPT4All: Time elapsed: ${timeElapsed} milliseconds`);

    const res = await model.call("Hello, my name is ");

    expect(typeof res).toBe("string");
  },
  600 * 1000
);
