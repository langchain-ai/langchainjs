/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { it } from "@jest/globals";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { RunLogPatch, StreamEvent } from "@langchain/core/tracers/log_stream";
import { AIMessageChunk } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { AgentExecutor, createReactAgent } from "../../agents/index.js";
import { pull } from "../../hub/index.js";
import { initChatModel } from "../universal.js";

// Make copies of API keys and remove them from the environment to avoid conflicts.

// OpenAI
const openAIApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "";

// Azure OpenAI
const azureOpenAIApiKey = process.env.AZURE_OPENAI_API_KEY;
process.env.AZURE_OPENAI_API_KEY = "";
const azureOpenAIApiDevelopmentName =
  process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = "";
const azureOpenAIApiVersion = process.env.AZURE_OPENAI_API_VERSION;
process.env.AZURE_OPENAI_API_VERSION = "";
const azureOpenAIBasePath = process.env.AZURE_OPENAI_BASE_PATH;
process.env.AZURE_OPENAI_BASE_PATH = "";

// Google
const googleApiKey = process.env.GOOGLE_API_KEY;
process.env.GOOGLE_API_KEY = "";

test("Initialize non-configurable models", async () => {
  const gpt4 = await initChatModel("gpt-4o-mini", {
    modelProvider: "openai",
    temperature: 0.25, // Funky temperature to verify it's being set properly.
    apiKey: openAIApiKey,
  });
  const claude = await initChatModel("claude-3-opus-20240229", {
    modelProvider: "anthropic",
    temperature: 0.25,
  });
  const gemini = await initChatModel("gemini-1.5-pro", {
    modelProvider: "google-genai",
    temperature: 0.25,
  });

  const gpt4Result = await gpt4.invoke("what's your name");
  expect(gpt4Result).toBeDefined();
  expect(gpt4Result.content.length).toBeGreaterThan(0);

  const claudeResult = await claude.invoke("what's your name");
  expect(claudeResult).toBeDefined();
  expect(claudeResult.content.length).toBeGreaterThan(0);

  const geminiResult = await gemini.invoke("what's your name");
  expect(geminiResult).toBeDefined();
  expect(geminiResult.content.length).toBeGreaterThan(0);
});

test("Works with model provider in model name", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any;
  const o3Mini = await initChatModel("openai:o3-mini", {
    temperature: 0.25,
    apiKey: openAIApiKey,
  });
  try {
    await o3Mini.invoke("what's your name");
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain("temperature");
});

test("Create a partially configurable model with no default model", async () => {
  const configurableModel = await initChatModel(undefined, {
    temperature: 0,
    configurableFields: ["model", "apiKey"],
  });

  const gpt4Result = await configurableModel.invoke("what's your name", {
    configurable: {
      model: "gpt-4o-mini",
      apiKey: openAIApiKey,
    },
  });
  expect(gpt4Result).toBeDefined();
  expect(gpt4Result.content.length).toBeGreaterThan(0);

  const claudeResult = await configurableModel.invoke("what's your name", {
    configurable: {
      model: "claude-3-5-sonnet-20240620",
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  });
  expect(claudeResult).toBeDefined();
  expect(claudeResult.content.length).toBeGreaterThan(0);
});

test("Create a fully configurable model with a default model and a config prefix", async () => {
  const configurableModelWithDefault = await initChatModel("gpt-4o-mini", {
    modelProvider: "openai",
    configurableFields: "any",
    configPrefix: "foo",
    temperature: 0,
  });

  const configurableResult = await configurableModelWithDefault.invoke(
    "what's your name",
    {
      configurable: {
        foo_apiKey: openAIApiKey,
      },
    }
  );
  expect(configurableResult).toBeDefined();
  expect(configurableResult.content.length).toBeGreaterThan(0);

  const configurableResult2 = await configurableModelWithDefault.invoke(
    "what's your name",
    {
      configurable: {
        foo_model: "claude-3-5-sonnet-20240620",
        foo_modelProvider: "anthropic",
        foo_temperature: 0.6,
        foo_apiKey: process.env.ANTHROPIC_API_KEY,
      },
    }
  );
  expect(configurableResult2).toBeDefined();
  expect(configurableResult2.content.length).toBeGreaterThan(0);
});

test("Bind tools to a configurable model", async () => {
  const getWeatherTool = tool(
    (input) => {
      // Do something with the input
      return JSON.stringify(input);
    },
    {
      schema: z
        .object({
          location: z
            .string()
            .describe("The city and state, e.g. San Francisco, CA"),
        })
        .describe("Get the current weather in a given location"),
      name: "GetWeather",
      description: "Get the current weather in a given location",
    }
  );

  const getPopulationTool = tool(
    (input) => {
      // Do something with the input
      return JSON.stringify(input);
    },
    {
      schema: z
        .object({
          location: z
            .string()
            .describe("The city and state, e.g. San Francisco, CA"),
        })
        .describe("Get the current population in a given location"),
      name: "GetPopulation",
      description: "Get the current population in a given location",
    }
  );

  const configurableModel = await initChatModel("gpt-4o-mini", {
    configurableFields: ["model", "modelProvider", "apiKey"],
    temperature: 0,
  });

  const configurableModelWithTools = configurableModel.bindTools([
    getWeatherTool,
    getPopulationTool,
  ]);

  const configurableToolResult = await configurableModelWithTools.invoke(
    "Which city is hotter today and which is bigger: LA or NY?",
    {
      configurable: {
        apiKey: openAIApiKey,
      },
    }
  );
  expect(configurableToolResult).toBeDefined();
  expect(configurableToolResult.tool_calls?.[0]).toBeDefined();
  if (!configurableToolResult.tool_calls?.[0]) return;
  expect(configurableToolResult.tool_calls?.[0].name).toBe("GetWeather");

  const configurableToolResult2 = await configurableModelWithTools.invoke(
    "Which city is hotter today and which is bigger: LA or NY?",
    {
      configurable: {
        model: "claude-3-5-sonnet-20240620",
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    }
  );
  expect(configurableToolResult2).toBeDefined();
  expect(configurableToolResult2.tool_calls?.[0]).toBeDefined();
  if (!configurableToolResult2.tool_calls?.[0]) return;
  expect(configurableToolResult2.tool_calls?.[0].name).toBe("GetWeather");
});

test("Can call bindTools", async () => {
  const gpt4 = await initChatModel(undefined, {
    modelProvider: "openai",
    temperature: 0.25, // Funky temperature to verify it's being set properly.
    apiKey: openAIApiKey,
  });
  const weatherTool = tool(
    (input) => {
      // Do something with the input
      return JSON.stringify(input);
    },
    {
      schema: z
        .object({
          location: z
            .string()
            .describe("The city and state, e.g. San Francisco, CA"),
        })
        .describe("Get the current weather in a given location"),
      name: "GetWeather",
      description: "Get the current weather in a given location",
    }
  );

  const gpt4WithTools = gpt4.bindTools([weatherTool]);
  const result = await gpt4WithTools.invoke(
    "What's the weather in San Francisco?"
  );
  expect(result.tool_calls?.[0]).toBeDefined();
  expect(result.tool_calls?.[0].name).toBe("GetWeather");
});

test("bindTools does not mutate original model instance", async () => {
  // This test verifies that bindTools doesn't mutate the original ConfigurableModel
  const originalModel = await initChatModel("gpt-4o-mini", {
    modelProvider: "openai",
    temperature: 0,
    apiKey: openAIApiKey,
  });

  const weatherTool = tool(() => "Sunny, 75°F", {
    schema: z.object({
      location: z.string().describe("The city and state"),
    }),
    name: "GetWeather",
    description: "Get the current weather",
  });

  // Call bindTools on the model
  const modelWithTools = originalModel.bindTools([weatherTool]);

  // Invoke the model with tools - it should be able to use tools
  const toolResult = await modelWithTools.invoke(
    "What's the weather in San Francisco?"
  );
  expect(toolResult.tool_calls).toBeDefined();
  expect(toolResult.tool_calls?.[0]?.name).toBe("GetWeather");

  // Now invoke the original model - it should NOT have tools bound
  const originalResult = await originalModel.invoke("What is 2 + 2?");
  expect(originalResult).toBeDefined();
  expect(originalResult.content).toBeDefined();
  // The original model should not have tool calls
  expect(originalResult.tool_calls).toBeUndefined();
});

test("Can call withStructuredOutput", async () => {
  const gpt4 = await initChatModel(undefined, {
    modelProvider: "openai",
    temperature: 0.25, // Funky temperature to verify it's being set properly.
    apiKey: openAIApiKey,
  });
  const weatherSchema = z
    .object({
      location: z
        .string()
        .describe("The city and state, e.g. San Francisco, CA"),
    })
    .describe("Get the current weather in a given location");

  const gpt4WithTools = gpt4.withStructuredOutput(weatherSchema, {
    name: "GetWeather",
  });
  const result = await gpt4WithTools.invoke(
    "What's the weather in San Francisco?"
  );
  expect(result).toBeDefined();
  expect(result.location).toBeDefined();
  expect(result.location).not.toBe("");
});

test("withStructuredOutput does not mutate original model instance", async () => {
  // This test verifies the fix for issue #8929
  // where withStructuredOutput would mutate the original ConfigurableModel instance
  const originalModel = await initChatModel("gpt-4o-mini", {
    modelProvider: "openai",
    temperature: 0,
    apiKey: openAIApiKey,
  });

  const schema = z.object({
    answer: z.string().describe("The answer to the question"),
  });

  // Call withStructuredOutput on the model
  const structuredModel = originalModel.withStructuredOutput(schema);

  // Invoke the structured model - it should return structured output
  const structuredResult = await structuredModel.invoke("What is 2 + 2?");
  expect(structuredResult).toBeDefined();
  expect(structuredResult.answer).toBeDefined();
  expect(typeof structuredResult.answer).toBe("string");

  // Now invoke the original model - it should return a regular message, NOT structured output
  const originalResult = await originalModel.invoke("What is 2 + 2?");
  expect(originalResult).toBeDefined();
  expect(originalResult.content).toBeDefined();
  expect(typeof originalResult.content).toBe("string");
  // Ensure it's not returning structured output
  expect((originalResult as any).answer).toBeUndefined();
});

test("ConfigurableModel works with agent after withStructuredOutput is called", async () => {
  // This test verifies that a ConfigurableModel can be used with an agent
  // even after withStructuredOutput has been called on the same instance
  const model = await initChatModel("gpt-4o-mini", {
    modelProvider: "openai",
    temperature: 0,
    apiKey: openAIApiKey,
  });

  const schema = z.object({
    result: z.string().describe("The result"),
  });

  // Call withStructuredOutput on the model (but don't use the result)
  model.withStructuredOutput(schema);

  // Create a simple tool for the agent
  const searchTool = tool(() => "Found: Item 1, Item 2, Item 3", {
    schema: z.object({ query: z.string() }),
    name: "search",
    description: "Search for items",
  });

  // The original model should still work with the agent
  // Using createReactAgent which is available in this version
  const prompt = PromptTemplate.fromTemplate(
    `Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}`
  );

  const agent = await createReactAgent({
    llm: model,
    prompt,
    tools: [],
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools: [searchTool],
  });

  const result = await agentExecutor.invoke({
    input: "Search for items please",
  });

  expect(result).toBeDefined();
  expect(result.input).toBeDefined();
  expect(result.output).toBeDefined();
  // The result should contain actual output, not throw an error
  expect(typeof result.output).toBe("string");
  expect(result.output.length).toBeGreaterThan(0);
});

describe("Works with all model providers", () => {
  it("Can invoke openai", async () => {
    const gpt4 = await initChatModel(undefined, {
      modelProvider: "openai",
      temperature: 0,
      apiKey: openAIApiKey,
    });

    const gpt4Result = await gpt4.invoke("what's your name");
    expect(gpt4Result).toBeDefined();
    expect(gpt4Result.content.length).toBeGreaterThan(0);
  });

  it("Can invoke anthropic", async () => {
    const anthropic = await initChatModel(undefined, {
      modelProvider: "anthropic",
      temperature: 0,
    });

    const anthropicResult = await anthropic.invoke("what's your name");
    expect(anthropicResult).toBeDefined();
    expect(anthropicResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke azure_openai", async () => {
    process.env.AZURE_OPENAI_API_KEY = azureOpenAIApiKey;
    process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME =
      azureOpenAIApiDevelopmentName;
    process.env.AZURE_OPENAI_API_VERSION = azureOpenAIApiVersion;
    process.env.AZURE_OPENAI_BASE_PATH = azureOpenAIBasePath;

    try {
      const azure_openai = await initChatModel(undefined, {
        modelProvider: "azure_openai",
        temperature: 0,
      });

      const azure_openaiResult = await azure_openai.invoke("what's your name");
      expect(azure_openaiResult).toBeDefined();
      expect(azure_openaiResult.content.length).toBeGreaterThan(0);
    } catch (e) {
      // Re-assign the original env vars.
      process.env.AZURE_OPENAI_API_KEY = "";
      process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = "";
      process.env.AZURE_OPENAI_API_VERSION = "";
      process.env.AZURE_OPENAI_BASE_PATH = "";
      // Re-throw the error.
      throw e;
    }
  });

  it("Can invoke cohere", async () => {
    const cohere = await initChatModel(undefined, {
      modelProvider: "cohere",
      temperature: 0,
    });

    const cohereResult = await cohere.invoke("what's your name");
    expect(cohereResult).toBeDefined();
    expect(cohereResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke google-genai", async () => {
    const googleVertexai = await initChatModel(undefined, {
      modelProvider: "google-genai",
      temperature: 0,
    });

    const googleVertexaiResult = await googleVertexai.invoke(
      "what's your name"
    );
    expect(googleVertexaiResult).toBeDefined();
    expect(googleVertexaiResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke google-genai", async () => {
    // Remove VertexAI env vars to avoid conflict.
    const googleApplicationCredentials =
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
    // Re-assign the Google API key for this test.
    process.env.GOOGLE_API_KEY = googleApiKey;

    try {
      const googleGenai = await initChatModel(undefined, {
        modelProvider: "google-genai",
        temperature: 0,
      });

      const googleGenaiResult = await googleGenai.invoke("what's your name");
      expect(googleGenaiResult).toBeDefined();
      expect(googleGenaiResult.content.length).toBeGreaterThan(0);
    } catch (e) {
      // Re-assign the original env vars.
      process.env.GOOGLE_APPLICATION_CREDENTIALS = googleApplicationCredentials;
      process.env.GOOGLE_API_KEY = "";
      throw e;
    }
  });

  it.skip("Can invoke ollama", async () => {
    const ollama = await initChatModel(undefined, {
      modelProvider: "ollama",
      temperature: 0,
      model: "llama3",
    });

    const ollamaResult = await ollama.invoke("what's your name");
    expect(ollamaResult).toBeDefined();
    expect(ollamaResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke mistralai", async () => {
    const mistralai = await initChatModel(undefined, {
      modelProvider: "mistralai",
      temperature: 0,
    });

    const mistralaiResult = await mistralai.invoke("what's your name");
    expect(mistralaiResult).toBeDefined();
    expect(mistralaiResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke groq", async () => {
    const groq = await initChatModel(undefined, {
      modelProvider: "groq",
      temperature: 0,
    });

    const groqResult = await groq.invoke("what's your name");
    expect(groqResult).toBeDefined();
    expect(groqResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke bedrock", async () => {
    const bedrock = await initChatModel(undefined, {
      modelProvider: "bedrock",
      temperature: 0,
      region: process.env.BEDROCK_AWS_REGION ?? "us-east-1",
      credentials: {
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
      },
    });

    const bedrockResult = await bedrock.invoke("what's your name");
    expect(bedrockResult).toBeDefined();
    expect(bedrockResult.content.length).toBeGreaterThan(0);
  });

  // If these two fail with an import error you should explicitly build `@langchain/community`
  it("Can invoke fireworks", async () => {
    const fireworks = await initChatModel(undefined, {
      modelProvider: "fireworks",
      temperature: 0,
    });

    const fireworksResult = await fireworks.invoke("what's your name");
    expect(fireworksResult).toBeDefined();
    expect(fireworksResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke together", async () => {
    const together = await initChatModel(undefined, {
      modelProvider: "together",
      temperature: 0,
    });

    const togetherResult = await together.invoke("what's your name");
    expect(togetherResult).toBeDefined();
    expect(togetherResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke google-vertexai-web", async () => {
    const vertexAIWeb = await initChatModel(undefined, {
      modelProvider: "google-vertexai-web",
      temperature: 0,
    });

    const vertexAIWebResult = await vertexAIWeb.invoke(
      "what's your name? Use the 'name' tool to respond."
    );
    expect(vertexAIWebResult).toBeDefined();
    expect(vertexAIWebResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke deepseek", async () => {
    const deepSeek = await initChatModel("deepseek-chat", {
      modelProvider: "deepseek",
      temperature: 0,
    });

    const deepSeekResult = await deepSeek.invoke("what's your name");
    expect(deepSeekResult).toBeDefined();
    expect(deepSeekResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke perplexity", async () => {
    const perplexity = await initChatModel("sonar-pro", {
      modelProvider: "perplexity",
      temperature: 0,
    });

    const perplexityResult = await perplexity.invoke("what's your name");
    expect(perplexityResult).toBeDefined();
    expect(perplexityResult.content.length).toBeGreaterThan(0);
  });
});

test("Is compatible with agents", async () => {
  const gpt4 = await initChatModel(undefined, {
    modelProvider: "openai",
    temperature: 0.25, // Funky temperature to verify it's being set properly.
    apiKey: openAIApiKey,
  });

  const weatherTool = tool(
    (_) => {
      // Do something with the input
      return "The current weather is partly cloudy with a high of 75 degrees.";
    },
    {
      schema: z.string().describe("The city and state, e.g. San Francisco, CA"),
      name: "GetWeather",
      description: "Get the current weather in a given location",
    }
  );

  const prompt = await pull<PromptTemplate>("hwchase17/react");

  const agent = await createReactAgent({
    llm: gpt4,
    tools: [weatherTool],
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools: [weatherTool],
  });

  const result = await agentExecutor.invoke({
    input:
      "What's the weather in San Francisco right now? Ensure you use the 'GetWeather' tool to answer.",
  });
  expect(result).toHaveProperty("output");
  expect(result.output).not.toBe("");
});

describe("Can call base runnable methods", () => {
  it("can call streamEvents", async () => {
    const gpt4 = await initChatModel(undefined, {
      modelProvider: "openai",
      temperature: 0.25, // Funky temperature to verify it's being set properly.
      apiKey: openAIApiKey,
    });

    const prompt = ChatPromptTemplate.fromMessages([["human", "{input}"]]);
    const stream = prompt.pipe(gpt4).streamEvents(
      {
        input: "what's your name",
      },
      {
        version: "v2",
        configurable: {
          model: "gpt-4o-mini",
        },
      }
    );

    const events: StreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    // The first event should be a start event.
    expect(events[0].event).toBe("on_chain_start");

    // Events in the middle should be stream events
    expect(
      events[Math.floor(events.length / 2)].event.endsWith("_stream")
    ).toBe(true);

    // The ;ast event should be an end event.
    expect(events[events.length - 1].event).toBe("on_chain_end");
  });

  it("can call streamLog", async () => {
    const gpt4 = await initChatModel(undefined, {
      modelProvider: "openai",
      temperature: 0.25, // Funky temperature to verify it's being set properly.
      apiKey: openAIApiKey,
    });

    const stream = gpt4.streamLog("what's your name");

    let runLog: RunLogPatch | undefined;
    for await (const event of stream) {
      if (!runLog) {
        runLog = event;
      } else {
        runLog = runLog.concat(event);
      }
    }
    expect(runLog).toBeDefined();
    if (!runLog) return;
    expect(runLog.ops.length).toBeGreaterThan(0);
  });

  it("can call stream", async () => {
    const gpt4 = await initChatModel(undefined, {
      modelProvider: "openai",
      temperature: 0.25, // Funky temperature to verify it's being set properly.
      apiKey: openAIApiKey,
    });

    const stream = await gpt4.stream("what's your name");
    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
    }

    expect(finalChunk).toBeDefined();
    if (!finalChunk) return;
    expect(finalChunk.content).not.toBe("");
  });

  it("can call batch", async () => {
    const gpt4 = await initChatModel(undefined, {
      modelProvider: "openai",
      temperature: 0.25, // Funky temperature to verify it's being set properly.
      apiKey: openAIApiKey,
    });

    const batchResult = await gpt4.batch([
      "what's your name",
      "what's your name",
    ]);

    expect(batchResult).toHaveLength(2);
    if (batchResult.length !== 2) return;
    expect(batchResult[0].content).not.toBe("");
    expect(batchResult[1].content).not.toBe("");
  });

  it("can call withConfig with tools", async () => {
    const weatherTool = {
      schema: z
        .object({
          location: z
            .string()
            .describe("The city and state, e.g. San Francisco, CA"),
        })
        .describe("Get the current weather in a given location"),
      name: "GetWeather",
      description: "Get the current weather in a given location",
    };

    const openaiModel = await initChatModel("gpt-4o-mini", {
      temperature: 0,
      apiKey: openAIApiKey,
    });

    const modelWithTools = openaiModel.bindTools([weatherTool], {
      tool_choice: "GetWeather",
    });
    expect(modelWithTools._queuedMethodOperations.bindTools).toBeDefined();
    expect(modelWithTools._queuedMethodOperations.bindTools[0][0].name).toBe(
      "GetWeather"
    );
    const modelWithConfig = modelWithTools.withConfig({ runName: "weather" });

    expect(modelWithConfig.bound).toHaveProperty("_queuedMethodOperations");
    expect(
      (modelWithConfig.bound as any)._queuedMethodOperations.bindTools
    ).toBeDefined();
    expect(
      (modelWithConfig.bound as any)._queuedMethodOperations.bindTools[0][0]
        .name
    ).toBe("GetWeather");

    expect(modelWithConfig.config.runName).toBe("weather");

    const result = await modelWithConfig.invoke("What's 8x8?");
    expect(result.tool_calls).toBeDefined();
    expect(result.tool_calls?.[0].name).toBe("GetWeather");
  });
});

describe("Serialization", () => {
  it("does not contain additional fields", async () => {
    const gpt4 = await initChatModel("gpt-4o-mini", {
      modelProvider: "openai",
      temperature: 0.25, // Funky temperature to verify it's being set properly.
      apiKey: openAIApiKey,
    });
    let serializedRepresentation;
    const res = await gpt4.invoke("foo", {
      callbacks: [
        {
          handleChatModelStart(llm) {
            serializedRepresentation = llm;
          },
        },
      ],
      configurable: { extra: "bar" },
    });
    await awaitAllCallbacks();
    expect(res).toBeDefined();
    const { ChatOpenAI } = await import("@langchain/openai");
    expect(serializedRepresentation).toEqual(
      JSON.parse(
        JSON.stringify(
          new ChatOpenAI({
            model: "gpt-4o-mini",
            temperature: 0.25,
            apiKey: openAIApiKey,
          })
        )
      )
    );
  });
});

// https://github.com/langchain-ai/langchainjs/issues/8962
describe("Can be initialized without `modelProvider`", () => {
  test.each([
    ["openai", "gpt-4o-mini"],
    ["anthropic", "claude-3-5-sonnet-20240620"],
    ["mistralai", "mistral-large-latest"],
  ])("for %s", async (_, modelName) => {
    const model = await initChatModel(modelName, {
      temperature: 0,
    });

    const modelResult = await model.invoke("what's your name");
    expect(modelResult).toBeDefined();
    expect(modelResult.content.length).toBeGreaterThan(0);
  });
});
