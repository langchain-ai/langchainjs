import { OpenAI } from "langchain/llms/openai";
import { JiraAPIWrapper, JiraAction } from "langchain/tools";
import { Version3Client } from "jira.js";
import {
  initializeAgentExecutorWithOptions,
  JiraToolkit
} from "langchain/agents";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const client = await new Version3Client({
    host: "https://yourdomain.atlassian.net",
    authentication: {
        basic: {
            email: "example@email.com",
            apiToken: "yourapitoken",
        },
    },
});
  const jira = new JiraAPIWrapper(client);

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

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
}
