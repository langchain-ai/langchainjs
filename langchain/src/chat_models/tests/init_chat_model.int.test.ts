/* eslint-disable no-process-env */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { it } from "@jest/globals";
import { initChatModel } from "../base.js";

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
  const gpt4 = await initChatModel("gpt-4", {
    modelProvider: "openai",
    temperature: 0.25, // Funky temperature to verify it's being set properly.
    apiKey: openAIApiKey,
  });
  const claude = await initChatModel("claude-3-opus-20240229", {
    modelProvider: "anthropic",
    temperature: 0.25,
  });
  const gemini = await initChatModel("gemini-1.5-pro", {
    modelProvider: "google_vertexai",
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

test("Create a partially configurable model with no default model", async () => {
  const configurableModel = await initChatModel(undefined, {
    temperature: 0,
    configurableFields: ["model", "apiKey"],
  });

  const gpt4Result = await configurableModel.invoke("what's your name", {
    configurable: {
      model: "gpt-4",
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
  const configurableModelWithDefault = await initChatModel("gpt-4", {
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

  const configurableModel = await initChatModel("gpt-4", {
    configurableFields: ["model", "modelProvider", "apiKey"],
    temperature: 0,
  });

  const configurableModelWithTools = configurableModel.bind({
    tools: [getWeatherTool, getPopulationTool],
  });

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

// Not implemented
test.skip("Can call bindTools", async () => {
  const gpt4 = await initChatModel(undefined, {
    modelProvider: "openai",
    temperature: 0.25, // Funky temperature to verify it's being set properly.
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

  const gpt4WithTools = gpt4.bindTools?.([weatherTool]);
  const result = await gpt4WithTools?.invoke(
    "What's the weather in San Francisco?"
  );
  console.log(result);
});

// Not implemented
test.skip("Can call withStructuredOutput", async () => {
  throw new Error("Not implemented");
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

  it("Can invoke google_vertexai", async () => {
    const google_vertexai = await initChatModel(undefined, {
      modelProvider: "google_vertexai",
      temperature: 0,
    });

    const google_vertexaiResult = await google_vertexai.invoke(
      "what's your name"
    );
    expect(google_vertexaiResult).toBeDefined();
    expect(google_vertexaiResult.content.length).toBeGreaterThan(0);
  });

  it("Can invoke google_genai", async () => {
    // Remove VertexAI env vars to avoid conflict.
    const googleApplicationCredentials =
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
    // Re-assign the Google API key for this test.
    process.env.GOOGLE_API_KEY = googleApiKey;

    try {
      const google_genai = await initChatModel(undefined, {
        modelProvider: "google_genai",
        temperature: 0,
      });

      const google_genaiResult = await google_genai.invoke("what's your name");
      expect(google_genaiResult).toBeDefined();
      expect(google_genaiResult.content.length).toBeGreaterThan(0);
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
});
