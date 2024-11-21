import { Stagehand } from "@browserbasehq/stagehand";
import {
  StagehandActTool,
  StagehandNavigateTool,
} from "@langchain/community/agents/toolkits/stagehand";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

async function main() {
  // Initialize Stagehand once and pass it to the tools
  const stagehand = new Stagehand({
    env: "LOCAL",
    enableCaching: true,
  });

  const actTool = new StagehandActTool(stagehand);
  const navigateTool = new StagehandNavigateTool(stagehand);
  const tools = [actTool, navigateTool];

  // Initialize the model
  const model = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0,
  });

  // Create the agent using langgraph
  const agent = createReactAgent({
    llm: model,
    tools: tools,
  });

  // Execute the agent
  const result = await agent.invoke({
    input: "Navigate to https://www.google.com",
  });
  console.log(`Agent answer: ${result.output}`);
  const result = await agent.invoke({ input: "Search for 'OpenAI'" });
  console.log(`Agent answer: ${result.output}`);
}

main();
