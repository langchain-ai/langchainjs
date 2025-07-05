import { ConneryService } from "@langchain/community/tools/connery";
import { ConneryToolkit } from "@langchain/community/agents/toolkits/connery";
import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

// Specify your Connery Runner credentials.
process.env.CONNERY_RUNNER_URL = "";
process.env.CONNERY_RUNNER_API_KEY = "";

// Specify OpenAI API key.
process.env.OPENAI_API_KEY = "";

// Specify your email address to receive the emails from examples below.
const recepientEmail = "test@example.com";

// Create a Connery Toolkit with all the available actions from the Connery Runner.
const conneryService = new ConneryService();
const conneryToolkit = await ConneryToolkit.createInstance(conneryService);

// Use OpenAI Functions agent to execute the prompt using actions from the Connery Toolkit.
const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
const agent = await initializeAgentExecutorWithOptions(
  conneryToolkit.tools,
  llm,
  {
    agentType: "openai-functions",
    verbose: true,
  }
);
const result = await agent.invoke({
  input:
    `Make a short summary of the webpage http://www.paulgraham.com/vb.html in three sentences ` +
    `and send it to ${recepientEmail}. Include the link to the webpage into the body of the email.`,
});
console.log(result.output);
