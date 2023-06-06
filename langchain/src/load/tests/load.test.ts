import { test, expect } from "@jest/globals";
import { stringify } from "yaml";
import { z } from "zod";

import { load } from "../index.js";
import { OpenAI, PromptLayerOpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { Cohere } from "../../llms/cohere.js";
import {
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  ChatPromptTemplate,
} from "../../prompts/chat.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { LangChainTracer } from "../../callbacks/index.js";
import {
  FewShotPromptTemplate,
  LengthBasedExampleSelector,
} from "../../prompts/index.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";
import { Calculator } from "../../tools/calculator.js";
import { RequestsGetTool } from "../../tools/requests.js";
import { JsonListKeysTool, JsonSpec } from "../../tools/json.js";
import { AgentExecutor } from "../../agents/executor.js";
import { CommaSeparatedListOutputParser } from "../../output_parsers/list.js";
import { StructuredOutputParser } from "../../output_parsers/structured.js";

test("serialize + deserialize llm", async () => {
  const llm = new PromptLayerOpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    promptLayerApiKey: "promptlayer-key",
  });
  const lc_argumentsBefore = llm.lc_kwargs;
  const str = JSON.stringify(llm, null, 2);
  expect(llm.lc_kwargs).toEqual(lc_argumentsBefore);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  expect(JSON.parse(str).kwargs.temperature).toBe(0.5);
  expect(JSON.parse(str).kwargs.modelName).toBe("davinci");
  expect(JSON.parse(str).kwargs.openAIApiKey.type).toBe("secret");
  expect(JSON.parse(str).kwargs.promptLayerApiKey.type).toBe("secret");
  const llm2 = await load<OpenAI>(str, {
    OPENAI_API_KEY: "openai-key",
    PROMPTLAYER_API_KEY: "promptlayer-key",
  });
  expect(llm2).toBeInstanceOf(OpenAI);
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
});

test("serialize + deserialize llm with optional deps", async () => {
  const llm = new Cohere({ temperature: 0.5, apiKey: "cohere-key" });
  const str = JSON.stringify(llm, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const llm2 = await load<Cohere>(
    str,
    { COHERE_API_KEY: "cohere-key" },
    { "langchain/llms/cohere": { Cohere } }
  );
  expect(llm2).toBeInstanceOf(Cohere);
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
  const llm3 = await load<Cohere>(
    str,
    { COHERE_API_KEY: "cohere-key" },
    { "langchain/llms/cohere": import("../../llms/cohere.js") }
  );
  expect(llm3).toBeInstanceOf(Cohere);
  expect(JSON.stringify(llm3, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain string prompt", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    verbose: true,
    openAIApiKey: "openai-key",
    callbacks: [
      new LangChainTracer(),
      // This custom handler is not serialized
      {
        handleLLMEnd(output) {
          console.log(output);
        },
      },
    ],
  });
  const prompt = PromptTemplate.fromTemplate("Hello, {name}!");
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain chat prompt", async () => {
  const llm = new ChatOpenAI({
    temperature: 0.5,
    modelName: "gpt-4",
    streaming: true,
    azureOpenAIApiKey: "openai-key",
    azureOpenAIApiInstanceName: "openai-instance",
    azureOpenAIApiDeploymentName: "openai-deployment",
    azureOpenAIApiVersion: "openai-version",
    prefixMessages: [
      {
        role: "system",
        content: "You're a nice assistant",
      },
    ],
  });
  const prompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate("You are talking to {name}."),
    HumanMessagePromptTemplate.fromTemplate("Hello, nice model."),
  ]);
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    AZURE_OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain few shot prompt w/ examples", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const prompt = new FewShotPromptTemplate({
    examples: [{ yo: "1" }, { yo: "2" }],
    prefix: "You are a nice assistant",
    examplePrompt: PromptTemplate.fromTemplate("An example about {yo}"),
    suffix: "My name is {name}",
    inputVariables: ["yo", "name"],
  });
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain few shot prompt w/ selector", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const examplePrompt = PromptTemplate.fromTemplate("An example about {yo}");
  const prompt = new FewShotPromptTemplate({
    exampleSelector: await LengthBasedExampleSelector.fromExamples(
      [{ yo: "1" }, { yo: "2" }],
      { examplePrompt }
    ),
    prefix: "You are a nice assistant",
    examplePrompt,
    suffix: "My name is {name}",
    inputVariables: ["yo", "name"],
  });
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  await expect(
    load<LLMChain>(str, {
      OPENAI_API_KEY: "openai-key",
    })
  ).rejects.toThrow(
    'Trying to load an object that doesn\'t implement serialization: {"lc":1,"type":"not_implemented","id":["langchain","prompts","selectors","LengthBasedExampleSelector"]}'
  );
});

test("serialize + deserialize llmchain with output parser", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const prompt = PromptTemplate.fromTemplate(
    "An example about {yo} {format_instructions}"
  );
  const outputParser = new CommaSeparatedListOutputParser();
  const chain = new LLMChain({ llm, prompt, outputParser });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
  expect(await chain2.outputParser?.parse("a, b, c")).toEqual(["a", "b", "c"]);
});

test("serialize + deserialize llmchain with struct output parser throws", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const prompt = PromptTemplate.fromTemplate(
    "An example about {yo} {format_instructions}"
  );
  const outputParser = new StructuredOutputParser(
    z.object({
      a: z.string(),
    })
  );
  const chain = new LLMChain({ llm, prompt, outputParser });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  await expect(
    load<LLMChain>(str, {
      OPENAI_API_KEY: "openai-key",
    })
  ).rejects.toThrow(
    'Trying to load an object that doesn\'t implement serialization: {"lc":1,"type":"not_implemented","id":["langchain","output_parsers","structured","StructuredOutputParser"]}'
  );
});

test("serialize + deserialize agent", async () => {
  const llm = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4",
    openAIApiKey: "openai-key",
  });
  const executor = await initializeAgentExecutorWithOptions(
    [
      new Calculator(),
      new RequestsGetTool(),
      new JsonListKeysTool(new JsonSpec({ a: "b" })),
    ],
    llm,
    {
      agentType: "chat-conversational-react-description",
    }
  );
  const str = JSON.stringify(executor, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const executor2 = await load<AgentExecutor>(
    str,
    { OPENAI_API_KEY: "openai-key" },
    {
      "langchain/tools/calculator": { Calculator },
    }
  );
  expect(executor2).toBeInstanceOf(AgentExecutor);
  expect(JSON.stringify(executor2, null, 2)).toBe(str);
});
