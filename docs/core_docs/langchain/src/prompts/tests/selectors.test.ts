import { expect, test } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { LengthBasedExampleSelector } from "../selectors/LengthBasedExampleSelector.js";
import { SemanticSimilarityExampleSelector } from "../selectors/SemanticSimilarityExampleSelector.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { PromptTemplate } from "../prompt.js";

test("Test using LengthBasedExampleSelector", async () => {
  const prompt = new PromptTemplate({
    template: "{foo} {bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  const selector = await LengthBasedExampleSelector.fromExamples(
    [{ foo: "one one one" }],
    {
      examplePrompt: prompt,
      maxLength: 10,
    }
  );
  await selector.addExample({ foo: "one two three" });
  await selector.addExample({ foo: "four five six" });
  await selector.addExample({ foo: "seven eight nine" });
  await selector.addExample({ foo: "ten eleven twelve" });
  const chosen = await selector.selectExamples({ foo: "hello", bar: "world" });
  expect(chosen).toStrictEqual([
    { foo: "one one one" },
    { foo: "one two three" },
  ]);
});

test("Test using SemanticSimilarityExampleSelector", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new FakeEmbeddings() // not using  OpenAIEmbeddings() because would be extra dependency
  );
  const selector = new SemanticSimilarityExampleSelector({
    vectorStore,
  });
  const chosen = await selector.selectExamples({ id: 1 });
  expect(chosen).toEqual([{ id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }]);
});

test("Test using SemanticSimilarityExampleSelector with metadata filtering", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new FakeEmbeddings() // not using  OpenAIEmbeddings() because would be extra dependency
  );
  const selector = new SemanticSimilarityExampleSelector({
    vectorStore,
    filter: (doc) => doc.metadata.id === 2,
  });
  const chosen = await selector.selectExamples({ id: 1 });
  expect(chosen).toEqual([{ id: 2 }]);
});

test("Test using SemanticSimilarityExampleSelector with a passed in retriever", async () => {
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new FakeEmbeddings() // not using  OpenAIEmbeddings() because would be extra dependency
  );
  const selector = new SemanticSimilarityExampleSelector({
    vectorStoreRetriever: vectorStore.asRetriever({ k: 5 }),
  });
  const chosen = await selector.selectExamples({ id: 1 });
  expect(chosen).toEqual([
    { id: 2 },
    { id: 1 },
    { id: 3 },
    { id: 4 },
    { id: 5 },
  ]);
});
