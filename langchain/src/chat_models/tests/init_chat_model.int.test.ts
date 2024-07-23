import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { it } from "@jest/globals";
import { initChatModel } from "../base.js";

test("Initialize non-configurable models", async () => {
  const gpt4 = await initChatModel("gpt-4", {
    modelProvider: "openai",
    temperature: 0.25, // Funky temperature to verify it's being set properly.
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
  });

  const gpt4Result = await configurableModel.invoke("what's your name", {
    configurable: { model: "gpt-4" },
  });
  expect(gpt4Result).toBeDefined();
  expect(gpt4Result.content.length).toBeGreaterThan(0);

  const claudeResult = await configurableModel.invoke("what's your name", {
    configurable: { model: "claude-3-5-sonnet-20240620" },
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
    "what's your name"
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
    configurableFields: ["model", "modelProvider"],
    temperature: 0,
  });

  const configurableModelWithTools = configurableModel.bind({
    tools: [getWeatherTool, getPopulationTool],
  });

  const configurableToolResult = await configurableModelWithTools.invoke(
    "Which city is hotter today and which is bigger: LA or NY?"
  );
  expect(configurableToolResult).toBeDefined();
  expect(configurableToolResult.tool_calls?.[0]).toBeDefined();
  if (!configurableToolResult.tool_calls?.[0]) return;
  expect(configurableToolResult.tool_calls?.[0].name).toBe("GetWeather");

  const configurableToolResult2 = await configurableModelWithTools.invoke(
    "Which city is hotter today and which is bigger: LA or NY?",
    { configurable: { model: "claude-3-5-sonnet-20240620" } }
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

test("Can call withStructuredOutput", async () => {
  throw new Error("Not implemented");
});

describe("Works with all model providers", () => {
  it("Can invoke openai", async () => {
    const gpt4 = await initChatModel(undefined, {
      modelProvider: "openai",
      temperature: 0,
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
    const azure_openai = await initChatModel(undefined, {
      modelProvider: "azure_openai",
      temperature: 0,
    });

    const azure_openaiResult = await azure_openai.invoke("what's your name");
    expect(azure_openaiResult).toBeDefined();
    expect(azure_openaiResult.content.length).toBeGreaterThan(0);
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
    const google_genai = await initChatModel(undefined, {
      modelProvider: "google_genai",
      temperature: 0,
    });

    const google_genaiResult = await google_genai.invoke("what's your name");
    expect(google_genaiResult).toBeDefined();
    expect(google_genaiResult.content.length).toBeGreaterThan(0);
  });

  it.skip("Can invoke ollama", async () => {});

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

  // todo: manually supply env vars via constructor!
  it("Can invoke bedrock", async () => {
    const bedrock = await initChatModel(undefined, {
      modelProvider: "bedrock",
      temperature: 0,
    });

    const bedrockResult = await bedrock.invoke("what's your name");
    expect(bedrockResult).toBeDefined();
    expect(bedrockResult.content.length).toBeGreaterThan(0);
  });

  it.skip("Can invoke fireworks", async () => {});

  it.skip("Can invoke together", async () => {});
});
