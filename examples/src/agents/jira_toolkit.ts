import { OpenAI } from "langchain/llms/openai";
import { JiraAPIWrapper, JiraAction } from "langchain/tools";
import {
  initializeAgentExecutorWithOptions,
  JiraToolkit,
} from "langchain/agents";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const jira = new JiraAPIWrapper({
    host: "",
    email: "",
    apiToken: "",
    jiraApiToken: "",
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

  const input = `Make a new issue in project YS to remind me to make more fried rice.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
