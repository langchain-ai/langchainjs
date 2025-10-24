import { test, expect } from "@jest/globals";
import { PromptTemplate } from "../../prompts/prompt.js";
import { FakeChatModel } from "../../utils/testing/index.js";
import { RunnablePassthrough } from "../passthrough.js";
import { JsonOutputParser } from "../../output_parsers/json.js";
import { RunnableSequence } from "../base.js";
import { RunnableConfig } from "../config.js";

test("RunnablePassthrough can call .assign and pass prev result through", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = new JsonOutputParser();
  const text = `\`\`\`
{"outputValue": "testing"}
\`\`\``;

  const chain = promptTemplate.pipe(llm).pipe(parser);

  const chainWithAssign = chain.pipe(
    RunnablePassthrough.assign({
      outputValue: (i) => i.outputValue,
    })
  );

  const result = await chainWithAssign.invoke({ input: text });
  console.log(result);
  expect(result).toEqual({ outputValue: "testing" });
});

test("RunnablePassthrough can call .assign as the first step with proper typing", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = new JsonOutputParser();
  const text = `\`\`\`
{"outputValue": "testing2"}
\`\`\``;

  const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
      input: (input) => input.otherProp,
    }),
    promptTemplate,
    llm,
    parser,
  ]);

  const result = await chain.invoke({ otherProp: text });
  console.log(result);
  expect(result).toEqual({ outputValue: "testing2" });
});

test("RunnablePassthrough can invoke a function without modifying passthrough value", async () => {
  let wasCalled = false;
  const addOne = (input: number) => {
    wasCalled = true;
    return input + 1;
  };
  const passthrough = new RunnablePassthrough<number>({
    func: addOne,
  });
  const result = await passthrough.invoke(1);
  expect(result).toEqual(1);
  expect(wasCalled).toEqual(true);
});

test("RunnablePassthrough can transform a function as constructor args", async () => {
  let wasCalled = false;
  const addOne = (input: number) => {
    wasCalled = true;
    return input + 1;
  };
  const passthrough = new RunnablePassthrough<number>({
    func: addOne,
  });
  async function* generateNumbers() {
    yield 1;
  }
  const transformedGenerator = passthrough.transform(generateNumbers(), {});
  const results = [];
  for await (const value of transformedGenerator) {
    results.push(value);
  }
  expect(results).toEqual([1]);
  expect(wasCalled).toEqual(true);
});

test("RunnablePassthrough can invoke a function and pass through config", async () => {
  let wasCalled = false;
  let addOneResult: number = 0;
  const addOne = (input: number, config?: RunnableConfig) => {
    wasCalled = true;
    if (
      !config?.configurable?.number ||
      Number.isNaN(config?.configurable?.number)
    ) {
      throw new Error("configurable.number is NaN");
    }
    console.log(config.configurable.number);
    addOneResult = input + config.configurable.number;
  };
  const passthrough = new RunnablePassthrough<number>({
    func: addOne,
  });
  const result = await passthrough.invoke(1, {
    configurable: {
      number: 1,
    },
  });
  expect(result).toEqual(1);
  expect(addOneResult).toEqual(2);
  expect(wasCalled).toEqual(true);
});
