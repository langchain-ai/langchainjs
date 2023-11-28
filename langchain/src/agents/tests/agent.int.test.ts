/* eslint-disable no-process-env */
import { expect, test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { loadAgent } from "../load.js";
import { AgentExecutor, ZeroShotAgent } from "../index.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { WebBrowser } from "../../tools/webbrowser.js";
import { Tool } from "../../tools/base.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { RunnableSequence } from "../../schema/runnable/base.js";
import { OutputParserException } from "../../schema/output_parser.js";
import { AIMessage, AgentStep } from "../../schema/index.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { ChatMessageHistory } from "../../memory/index.js";

test("Run agent from hub", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-babbage-001" });
  const tools: Tool[] = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];
  const agent = await loadAgent(
    "lc://agents/zero-shot-react-description/agent.json",
    { llm: model, tools }
  );
  const executor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });
  const res = await executor.call({
    input:
      "Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?",
  });
  console.log(
    {
      res,
    },
    "Run agent from hub response"
  );
  expect(res.output).not.toEqual("");
  expect(res.output).not.toEqual("Agent stopped due to max iterations.");
});

test("Pass runnable to agent executor", async () => {
  const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-3.5-turbo" });
  const tools: Tool[] = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const prompt = ZeroShotAgent.createPrompt(tools);
  const outputParser = ZeroShotAgent.getDefaultOutputParser();

  const runnable = RunnableSequence.from([
    {
      input: (i: { input: string }) => i.input,
      agent_scratchpad: (i: { input: string }) => i.input,
    },
    prompt,
    model,
    outputParser,
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnable,
    tools,
  });
  const res = await executor.invoke({
    input:
      "Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?",
  });
  console.log(
    {
      res,
    },
    "Pass runnable to agent executor"
  );
  expect(res.output).not.toEqual("");
  expect(res.output).not.toEqual("Agent stopped due to max iterations.");
});

test("Custom output parser", async () => {
  const model = new ChatOpenAI({ temperature: 0, modelName: "gpt-3.5-turbo" });
  const tools: Tool[] = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const parser = (output: AIMessage) => {
    const text = output.content;
    if (typeof text !== "string") {
      throw new Error("Cannot parse non-string output.");
    }
    if (text.includes("Final Answer:")) {
      return {
        returnValues: {
          output: "We did it!",
        },
        log: text,
      };
    }

    const match = /Action:([\s\S]*?)(?:\nAction Input:([\s\S]*?))?$/.exec(text);
    if (!match) {
      throw new OutputParserException(`Could not parse LLM output: ${text}`);
    }

    return {
      tool: match[1].trim(),
      toolInput: match[2]
        ? match[2].trim().replace(/^("+)(.*?)(\1)$/, "$2")
        : "",
      log: text,
    };
  };

  const prompt = ZeroShotAgent.createPrompt(tools);

  const runnable = RunnableSequence.from([
    {
      input: (i: { input: string }) => i.input,
      agent_scratchpad: (i: { input: string }) => i.input,
    },
    prompt,
    model,
    parser,
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnable,
    tools,
  });
  const res = await executor.invoke({
    input:
      "Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?",
  });
  console.log(
    {
      res,
    },
    "Custom output parser"
  );
  expect(res.output).toEqual("We did it!");
});

test("Add a fallback method", async () => {
  // Model should always fail since the model name passed does not exist.
  const modelBase = new ChatOpenAI({
    modelName: "fake-model",
    temperature: 10,
  });

  const modelLarge = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-16k",
    temperature: 0.6,
  });

  const model = modelBase.withFallbacks({
    fallbacks: [modelLarge],
  });

  const prompt = ZeroShotAgent.createPrompt([]);
  const outputParser = ZeroShotAgent.getDefaultOutputParser();

  const runnable = RunnableSequence.from([
    {
      input: (i: { input: string }) => i.input,
      agent_scratchpad: (i: { input: string }) => i.input,
    },
    prompt,
    model,
    outputParser,
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnable,
    tools: [],
  });
  const res = await executor.invoke({
    input: "Is the sky blue? Response with a concise answer",
  });
  console.log(
    {
      res,
    },
    "Pass runnable to agent executor"
  );
  expect(res.output).not.toEqual("");
  expect(res.output).not.toEqual("Agent stopped due to max iterations.");
});

test("Run agent locally", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-babbage-001" });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
  });
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });
  console.log(
    {
      result,
    },
    "Run agent locally"
  );
  expect(result.output).not.toEqual("");
  expect(result.output).not.toEqual("Agent stopped due to max iterations.");
});

test("Run agent with an abort signal", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-babbage-001" });
  const tools = [new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
  });
  console.log("Loaded agent.");

  const input = `What is 3 to the fourth power?`;
  console.log(`Executing with input "${input}"...`);

  const controller = new AbortController();
  await expect(() => {
    const result = executor.call({ input, signal: controller.signal });
    controller.abort();
    return result;
  }).rejects.toThrow();
});

test("Run agent with incorrect api key should throw error", async () => {
  const model = new OpenAI({
    temperature: 0,
    modelName: "text-babbage-001",
    openAIApiKey: "invalid",
  });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
  });
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  let error;
  // Test that the model throws an error
  await expect(async () => {
    try {
      await model.call(input);
    } catch (e) {
      error = e;
      throw e;
    }
  }).rejects.toThrowError();

  // Test that the agent throws the same error
  await expect(() => executor.call({ input })).rejects.toThrowError(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).message
  );
}, 10000);

test("Run tool web-browser", async () => {
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
    new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    returnIntermediateSteps: true,
  });
  console.log("Loaded agent.");

  const input = `What is the word of the day on merriam webster`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });
  console.log(
    {
      result,
    },
    "Run tool web-browser"
  );
  expect(result.intermediateSteps.length).toBeGreaterThanOrEqual(1);
  expect(result.intermediateSteps[0].action.tool).toEqual("search");
  expect(result.intermediateSteps[1].action.tool).toEqual("web-browser");
  expect(result.output).not.toEqual("");
  expect(result.output).not.toEqual("Agent stopped due to max iterations.");
});

test("Agent can stream", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4-1106-preview",
    streaming: true,
  });
  const tools = [
    new Calculator(),
    new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    returnIntermediateSteps: false,
  });
  console.log("Loaded agent.");

  const input = `What is the word of the day on merriam webster`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.stream({ input });
  let streamIters = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalResponse: any = [];
  for await (const item of result) {
    streamIters += 1;
    console.log("Stream item:", item);
    // each stream does NOT contain the previous steps,
    // because returnIntermediateSteps is false so we
    // push each new stream item to the array.
    finalResponse.push(item);
  }

  // The last item should contain "output"
  expect("output" in finalResponse[finalResponse.length - 1]).toBeTruthy();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intermediateSteps = finalResponse.flatMap((item: any) => {
    if ("intermediateSteps" in item) {
      return item.intermediateSteps;
    }
    return [];
  });

  expect(streamIters).toBeGreaterThan(1);
  const toolsUsed: Array<string> = intermediateSteps.map(
    (step: AgentStep) => step.action.tool
  );
  // the last tool used should be the web-browser
  expect(toolsUsed?.[toolsUsed.length - 1]).toEqual("web-browser");
});

test("Agent can stream with chat messages", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4-1106-preview",
    streaming: true,
  });
  const tools = [
    new Calculator(),
    new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
  ];
  const memory = new BufferMemory({
    chatHistory: new ChatMessageHistory([]),
    memoryKey: "chat_history",
    inputKey: "input",
    outputKey: "output",
    returnMessages: true,
  });

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
    returnIntermediateSteps: true,
    memory,
  });
  console.log("Loaded agent.");

  const input = `What is the word of the day on merriam webster, and what is the sum of all letter indices (relative to the english alphabet) in the word?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.stream({ input, chat_history: [] });
  let streamIters = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalResponse: any;
  for await (const item of result) {
    streamIters += 1;
    console.log("Stream item:", item);
    // each stream contains the previous steps
    // because returnIntermediateSteps is true),
    // so we can overwrite on each stream.
    finalResponse = item;
  }

  console.log("__finalResponse__", finalResponse);

  expect("intermediateSteps" in finalResponse).toBeTruthy();
  expect("output" in finalResponse).toBeTruthy();

  expect(streamIters).toBeGreaterThan(1);
  const toolsUsed: Array<string> = finalResponse.intermediateSteps.map(
    (step: AgentStep) => step.action.tool
  );
  // the first tool used should be web-browser, and last should be calculator.
  // This can be flaky so if the test is failing, inspect these conditions first.
  expect(toolsUsed?.[toolsUsed.length - 1]).toEqual("calculator");
  expect(toolsUsed?.[0]).toEqual("web-browser");
});
