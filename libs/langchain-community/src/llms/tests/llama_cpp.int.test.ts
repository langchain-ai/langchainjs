/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { LlamaCpp } from "../llama_cpp.js";

const llamaPath = getEnvironmentVariable("LLAMA_PATH")!;

test.skip("Test Llama_CPP", async () => {
  const model = await LlamaCpp.initialize({ modelPath: llamaPath });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("Where do Llamas live?");
  // console.log(res);
}, 100000);

test.skip("Test Llama_CPP", async () => {
  const model = await LlamaCpp.initialize({ modelPath: llamaPath });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("Where do Pandas live?");
  // console.log(res);
}, 100000);

test.skip("Test Llama_CPP", async () => {
  const model = await LlamaCpp.initialize({ modelPath: llamaPath });

  // Attempt to make several queries and make sure that the system prompt
  // is not returned as part of any follow-on query.
  for (let i = 0; i < 5; i += 1) {
    const res = await model.invoke("Where do Pandas live?");
    expect(res).not.toContain(
      "You are a helpful, respectful and honest assistant."
    );
  }
}, 100000);

test.skip("Test Llama_CPP", async () => {
  const model = await LlamaCpp.initialize({
    modelPath: llamaPath,
    temperature: 0.7,
  });

  const stream = await model.stream(
    "Tell me a short story about a happy Llama."
  );

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    process.stdout.write(chunks.join(""));
  }

  expect(chunks.length).toBeGreaterThan(1);
});

// gbnf grammer test
const gbnfListGrammer =
  'root ::= item+ # Excludes various line break characters item ::= "- " [^\r\n\x0b\x0c\x85\u2028\u2029]+ "\n"';

test.skip("Test Llama_CPP", async () => {
  const model = await LlamaCpp.initialize({
    modelPath: llamaPath,
    gbnf: gbnfListGrammer,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke(
    "Can you give me a list of 3 cute llama names?"
  );
  // console.log(res);
}, 100000);

// JSON schema test

const schemaJSON = {
  type: "object",
  properties: {
    responseMessage: {
      type: "string",
    },
    responseMetaData: {
      type: "string",
    },
    requestPositivityScoreFromOneToTen: {
      type: "number",
    },
  },
};

test.skip("Test Llama_CPP", async () => {
  const model = await LlamaCpp.initialize({
    modelPath: llamaPath,
    jsonSchema: schemaJSON,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("Where do llamas live?");
  // console.log(res);
}, 100000);
