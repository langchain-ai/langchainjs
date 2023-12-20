import { test } from "@jest/globals";
import { FakeLLM } from "../../utils/testing/index.js";

test("Test FakeLLM uses callbacks", async () => {
  const model = new FakeLLM({});
  let acc = "";
  const response = await model.invoke("Hello there!", {
    callbacks: [
      {
        handleLLMNewToken: (token: string) => {
          console.log(token);
          acc += token;
        },
      },
    ],
  });
  expect(response).toEqual(acc);
});

test("Test FakeLLM uses callbacks with a cache", async () => {
  const model = new FakeLLM({
    cache: true,
  });
  let acc = "";
  const response = await model.invoke("Hello there!");
  const response2 = await model.invoke("Hello there!", {
    callbacks: [
      {
        handleLLMNewToken: (token: string) => {
          console.log(token);
          acc += token;
        },
      },
    ],
  });
  expect(response).toEqual(response2);
  expect(response2).toEqual(acc);
});
