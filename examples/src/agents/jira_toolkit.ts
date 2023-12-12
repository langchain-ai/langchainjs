import { OpenAI } from "langchain/llms/openai";
import { JiraToolkit } from "@langchain/community/agents/toolkits/jira";
import { JiraAPIWrapper } from "@langchain/community/tools/jira";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const jira = new JiraAPIWrapper({
    host: "https://yourdomain.atlassian.net",
    email: "example@email.com",
    apiToken: "<api_token>", // Optional parameter; will fall back to environment variable if unavailable.
  });

  const toolkit = await new JiraToolkit(jira);

  const executor = await initializeAgentExecutorWithOptions(
    toolkit.tools,
    model,
    {
      agentType: "zero-shot-react-description",
      verbose: true,
    }
  );

  console.log("Loaded agent.");

  const input = `Make a new issue in project PW to remind me to make more fried rice.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input });

  console.log(`Got output ${result.output}`);
};
