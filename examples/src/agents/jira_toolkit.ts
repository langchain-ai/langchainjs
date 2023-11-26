import { OpenAI } from "langchain/llms/openai";
import { JiraAPIWrapper } from "langchain/tools";
import {
  initializeAgentExecutorWithOptions,
  JiraToolkit,
} from "langchain/agents";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const jira = await new JiraAPIWrapper({
    host: "https://wenduosky.atlassian.net",
    username: "",
    password: "",
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

  const input = `Return the information for issue with ID YS-202.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
}
