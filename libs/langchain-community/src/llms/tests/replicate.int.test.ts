import { test, expect } from "@jest/globals";
import { Replicate } from "../replicate.js";

// Test skipped because Replicate appears to be timing out often when called
test.skip("Test Replicate", async () => {
  const model = new Replicate({
    model:
      "a16z-infra/llama13b-v2-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
    input: {
      max_length: 10,
    },
  });

  const res = await model.invoke("Hello, my name is ");

  console.log({ res });

  expect(typeof res).toBe("string");
});

test.skip("Test Replicate streaming", async () => {
  const model = new Replicate({
    model:
      "a16z-infra/llama13b-v2-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
    input: {
      max_length: 10,
    },
  });

  const stream = await model.stream("Hello, my name is ");

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.log(chunks);
  expect(chunks.length).toBeGreaterThan(1);
});

test.skip("Serialise Replicate", () => {
  const model = new Replicate({
    model:
      "a16z-infra/llama13b-v2-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
    input: {
      max_length: 10,
    },
  });

  const serialised = JSON.stringify(model.toJSON());

  expect(JSON.parse(serialised)).toMatchInlineSnapshot(`
    {
      "id": [
        "langchain",
        "llms",
        "replicate",
        "Replicate",
      ],
      "kwargs": {
        "api_key": {
          "id": [
            "REPLICATE_API_TOKEN",
          ],
          "lc": 1,
          "type": "secret",
        },
        "input": {
          "max_length": 10,
        },
        "model": "a16z-infra/llama13b-v2-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
      },
      "lc": 1,
      "type": "constructor",
    }
  `);
});
