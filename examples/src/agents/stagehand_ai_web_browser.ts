import { StagehandToolkit } from "@langchain/community/agents/toolkits/stagehand";
import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
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

// Use OpenAI Functions agent to execute the prompt using actions from the Stagehand Toolkit.
const llm = new ChatOpenAI({ temperature: 0 });

const agent = await initializeAgentExecutorWithOptions(
  stagehandToolkit.tools,
  llm,
  {
    agentType: "openai-functions",
    verbose: true,
  }
);
// keep actions atomic
await agent.invoke({
  input: `Navigate to https://www.google.com`,
});

await agent.invoke({
  input: `Search for "OpenAI"`,
});
