import { expect, test } from "@jest/globals";
// import * as fs from "fs";
// import * as path from "path";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { LengthBasedExampleSelector } from "../selectors/LengthBasedExampleSelector.js";
import { SemanticSimilarityExampleSelector } from "../selectors/SemanticSimilarityExampleSelector.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
// import { RecursiveCharacterTextSplitter } from "../../text_splitter.js";
import { PromptTemplate } from "../prompt.js";

test("Test using LengthBasedExampleSelector", async () => {
  const prompt = new PromptTemplate({
    template: "{foo} {bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  const selector = new LengthBasedExampleSelector({
    examplePrompt: prompt,
    maxLength: 10,
  });
  await selector.addExample({ foo: "one two three" });
  await selector.addExample({ foo: "four five six" });
  await selector.addExample({ foo: "seven eight nine" });
  await selector.addExample({ foo: "ten eleven twelve" });
  const chosen = await selector.selectExamples({ foo: "hello", bar: "world" });
  expect(chosen).toStrictEqual([
    { foo: "one two three" },
    { foo: "four five six" },
  ]);
});

test("Test using SemanticSimilarityExampleSelector", async () => {
  /* Load in the file we want to do question answering over */
  // const text = fs.readFileSync("../examples/state_of_the_union.txt", "utf8");
  /* Split the text into chunks */
  // const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  // const docs = await textSplitter.createDocuments([text]);

  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "bye", "hi"],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }],
    // new OpenAIEmbeddings()
    new FakeEmbeddings()
  );
  // const vectorStore = await Chroma.fromDocuments(
  //   docs,
  //   new FakeEmbeddings(),
  //   "state_of_the_union"
  // );
  const selector = new SemanticSimilarityExampleSelector({
    vectorStore,
  });
  const chosen = await selector.selectExamples({ id: 1 });
  expect(chosen).toEqual([{ id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }]);
});
