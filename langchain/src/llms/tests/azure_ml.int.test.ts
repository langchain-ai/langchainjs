/* import { test, expect } from "@jest/globals";
import {
  AzureMLOnlineEndpoint,
  DollyContentFormatter,
  GPT2ContentFormatter,
  HFContentFormatter,
  LlamaContentFormatter,
} from "../azure_ml.js";

// LLama Test
test("Test AzureML LLama Call", async () => {
  const prompt = "What is the meaning of Foo?";
  const model = new AzureMLOnlineEndpoint({
    contentFormatter: new LlamaContentFormatter(),
  });

  const res = await model.call(prompt);
  expect(typeof res).toBe("string");

  console.log(res);
});


// GPT2 Test
test("Test AzureML GPT2 Call", async () => {
  const prompt = "What is the meaning of Foo?";
  const model = new AzureMLOnlineEndpoint({
    contentFormatter: new GPT2ContentFormatter(),
  });

  const res = await model.call(prompt);
  expect(typeof res).toBe("string");

  console.log(res);
});


// HF Test
test("Test AzureML HF Call", async () => {
  const prompt = "What is the meaning of Foo?";
  const model = new AzureMLOnlineEndpoint({
    contentFormatter: new HFContentFormatter(),
  });

  const res = await model.call(prompt);
  expect(typeof res).toBe("string");

  console.log(res);
});


// Dolly Test
test("Test AzureML Dolly Call", async () => {
  const prompt = "What is the meaning of Foo?";
  const model = new AzureMLOnlineEndpoint({
    contentFormatter: new DollyContentFormatter(),
  });

  const res = await model.call(prompt);
  expect(typeof res).toBe("string");

  console.log(res);
});
*/
