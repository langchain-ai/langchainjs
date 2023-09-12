import { test, describe } from "@jest/globals";
import { NIBittensorLLM } from "../bittensor.js";

describe.skip("NIBittensorLLM", () => {
  test("test with no params", async () => {
    const niBittensorLLM = new NIBittensorLLM();
    const result = await niBittensorLLM.call("What is Bittensor?");
    console.log("test with no params: ", result);
  });
  test("test with system prompt", async () => {
    const niBittensorLLM = new NIBittensorLLM({
      systemPrompt:
        "You are an assistant which is created by Neural Internet(NI) in decentralized network named as a Bittensor. Your task is to provide accurate response based on user prompt",
    });
    const result = await niBittensorLLM.call("What is Bittensor?");
    console.log("test with system prompt: ", result);
  });
  test("test with topResponse parameter", async () => {
    const niBittensorLLM = new NIBittensorLLM({
      systemPrompt:
        "You are an assistant which is created by Neural Internet(NI) in decentralized network named as a Bittensor. Your task is to provide accurate response based on user prompt",
      topResponses: 10,
    });
    const result = await niBittensorLLM.call("What is Bittensor?");
    console.log("test with topResponse parameter: ", result);
  });
});
