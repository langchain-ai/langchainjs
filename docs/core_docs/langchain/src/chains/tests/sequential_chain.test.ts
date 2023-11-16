import { test, expect } from "@jest/globals";
import { BaseLLM } from "../../llms/base.js";
import { AIMessage, HumanMessage, LLMResult } from "../../schema/index.js";
import { LLMChain } from "../llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import { SequentialChain } from "../sequential_chain.js";
import { BufferMemory, ChatMessageHistory } from "../../memory/index.js";

class FakeLLM1 extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake_1";
  }

  async _generate(_prompts: string[]): Promise<LLMResult> {
    return {
      generations: [
        [
          {
            text: "The answer is XXX.",
          },
        ],
      ],
    };
  }
}

class FakeLLM2 extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake_2";
  }

  async _generate(prompts: string[]): Promise<LLMResult> {
    let response = "I don't know what you are talking about.";
    if (prompts[0].includes("XXX")) {
      response = "final answer";
    }
    return {
      generations: [
        [
          {
            text: response,
          },
        ],
      ],
    };
  }
}

class FakeLLM3 extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake_2";
  }

  async _generate(prompts: string[]): Promise<LLMResult> {
    const inputNumber = +prompts[0];
    let response = "Not a number!!!";
    if (prompts[0].startsWith("Final Answer: ")) {
      [response] = prompts;
    } else if (!Number.isNaN(inputNumber)) {
      response = (inputNumber + 1).toString();
    }
    return {
      generations: [
        [
          {
            text: response,
          },
        ],
      ],
    };
  }
}

test("Test SequentialChain", async () => {
  const model1 = new FakeLLM1({});
  const model2 = new FakeLLM2({});
  const template1 = "Some arbitrary template with fake {input1} and {input2}.";
  const template2 = "Some arbitrary template with fake {input3}.";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1", "input2"],
  });
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input3"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "input3",
  });
  const chain2 = new LLMChain({ llm: model2, prompt: prompt2 });
  const combinedChain = new SequentialChain({
    chains: [chain1, chain2],
    inputVariables: ["input1", "input2"],
    outputVariables: ["text"],
  });
  const response = await combinedChain.call({
    input1: "test1",
    input2: "test2",
  });
  expect(response).toMatchInlineSnapshot(`
    {
      "text": "final answer",
    }
  `);
});

test("Test SequentialChain input/output chains' validation", () => {
  const model1 = new FakeLLM1({});
  const template1 = "Some arbitrary template with fake {input1} and {input2}.";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1", "input2"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "input3",
  });
  const model2 = new FakeLLM2({});
  const template2 = "Some arbitrary template with fake {input3}.";
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input3"],
  });
  const chain2 = new LLMChain({ llm: model2, prompt: prompt2 });

  expect(() => {
    /* eslint-disable no-new */
    new SequentialChain({
      chains: [chain1, chain2],
      inputVariables: ["input1"],
      outputVariables: ["text"],
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"Missing variables for chain "llm": "input2". Only got the following variables: "input1"."`
  );
  expect(() => {
    /* eslint-disable no-new */
    new SequentialChain({
      chains: [chain1, chain2],
      inputVariables: ["input1", "input2"],
      outputVariables: ["nonexistent"],
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"The following output variables were expected to be in the final chain output but were not found: "nonexistent"."`
  );
});

test("Test SequentialChain chains' intermediate variables validation", () => {
  const model1 = new FakeLLM1({});
  const template1 = "Some arbitrary template with fake {input1} and {input2}.";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1", "input2"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "nonexistent",
  });
  const model2 = new FakeLLM2({});
  const template2 = "Some arbitrary template with fake {input3}.";
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input3"],
  });
  const chain2 = new LLMChain({ llm: model2, prompt: prompt2 });

  expect(() => {
    /* eslint-disable no-new */
    new SequentialChain({
      chains: [chain1, chain2],
      inputVariables: ["input1", "input2"],
      outputVariables: ["text"],
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"Missing variables for chain "llm": "input3". Only got the following variables: "input1", "input2", "nonexistent"."`
  );
});

test("Test SequentialChain chains passes all outputs", async () => {
  const model1 = new FakeLLM3({});
  const template1 = "{input1}";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "input2",
  });

  const model2 = new FakeLLM3({});
  const template2 = "{input2}";
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input2"],
  });
  const chain2 = new LLMChain({
    llm: model2,
    prompt: prompt2,
    outputKey: "input3",
  });

  const model3 = new FakeLLM3({});
  const template3 = "Final Answer: {input1} {input2} {input3}.";
  const prompt3 = new PromptTemplate({
    template: template3,
    inputVariables: ["input1", "input2", "input3"],
  });
  const chain3 = new LLMChain({ llm: model3, prompt: prompt3 });

  const combinedChain = new SequentialChain({
    chains: [chain1, chain2, chain3],
    inputVariables: ["input1"],
    outputVariables: ["text"],
  });
  expect(
    await combinedChain.call({
      input1: "1",
    })
  ).toMatchInlineSnapshot(`
  {
    "text": "Final Answer: 1 2 3.",
  }
`);
});

test("Test SequentialChain for memory on one of the sub-chains", async () => {
  const model1 = new FakeLLM1({});
  const template1 = "Some arbitrary template with fake {input1}.";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "input2",
  });

  const memory = new BufferMemory({
    memoryKey: "chat",
    chatHistory: new ChatMessageHistory([
      new HumanMessage("Hello"),
      new AIMessage("Hi"),
    ]),
    inputKey: "input2",
  });

  const model2 = new FakeLLM3({});
  const template2 = "Final Answer: \n{chat}\n{input2}";
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input2", "chat"],
  });
  const chain2 = new LLMChain({
    llm: model2,
    prompt: prompt2,
    memory,
  });

  const combinedChain = new SequentialChain({
    chains: [chain1, chain2],
    inputVariables: ["input1"],
    outputVariables: ["text"],
  });

  const result = await combinedChain.call({ input1: "test1" });

  expect(result).toMatchObject({
    text: "Final Answer: \nHuman: Hello\nAI: Hi\nThe answer is XXX.",
  });
});
