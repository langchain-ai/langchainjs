import { StagehandToolkit } from "@langchain/community/agents/toolkits/stagehand";
import { ChatOpenAI } from "@langchain/openai";
import { Stagehand } from "@browserbasehq/stagehand";

// Specify your Browserbase credentials.
process.env.BROWSERBASE_API_KEY = "";
process.env.BROWSERBASE_PROJECT_ID = "";

// Specify OpenAI API key.
process.env.OPENAI_API_KEY = "";

const stagehand = new Stagehand({
  env: "BROWSERBASE", // run on a remote browser, or "LOCAL" to run on your local machine
  headless: true,
  verbose: 2,
  debugDom: true,
  enableCaching: false,
});

// Create a Stagehand Toolkit with all the available actions from the Stagehand.
const stagehandToolkit = await StagehandToolkit.fromStagehand(stagehand);

const llm = new ChatOpenAI({ temperature: 0 });

if (!llm.bindTools) {
  throw new Error("Language model does not support tools.");
}

// Bind tools to the LLM
const llmWithTools = llm.bindTools(stagehandToolkit.tools);

// Execute queries atomically
await llmWithTools.invoke("Navigate to https://www.google.com");
await llmWithTools.invoke('Search for "OpenAI"');
