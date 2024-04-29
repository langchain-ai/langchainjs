import { test, expect } from "@jest/globals";
import { Replicate } from "../replicate.js";

// Test skipped because Replicate appears to be timing out often when called
test("Test Replicate", async () => {
  const model = new Replicate({
    model: "lucataco/phi-3-mini-4k-instruct:c4576a0e0c076f0feeced00df4ed332c60ffd8de781afef68ff0611645548162",
    input: {
      max_length: 10,
    },
  });

  const res = await model.invoke("Hello, my name is ");

  console.log({ res });

  expect(typeof res).toBe("string");
  expect(res).not.toBe("");
}, 60000);

test("Test Replicate Streaming", async () => {
  const model = new Replicate({
    model: "lucataco/phi-3-mini-4k-instruct:c4576a0e0c076f0feeced00df4ed332c60ffd8de781afef68ff0611645548162",
    input: {
      max_length: 10,
    },
    streaming: true,
  });

  const res = await model.invoke("Hello, my name is ");

  console.log({ res });

  expect(typeof res).toBe("string");
  expect(res).not.toBe("");
}, 60000);

test.skip("Serialise Replicate", () => {
  const model = new Replicate({
    model:
      "lucataco/phi-3-mini-4k-instruct:c4576a0e0c076f0feeced00df4ed332c60ffd8de781afef68ff0611645548162",
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
        "model": "lucataco/phi-3-mini-4k-instruct:c4576a0e0c076f0feeced00df4ed332c60ffd8de781afef68ff0611645548162",
      },
      "lc": 1,
      "type": "constructor",
    }
  `);
});
