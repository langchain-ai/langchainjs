import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ConneryToolkit } from "langchain/agents/toolkits/connery";
import { ConneryService } from "langchain/tools/connery";

const conneryService = new ConneryService();
const conneryToolkit = await ConneryToolkit.createInstance(conneryService);

const llm = new OpenAI({ temperature: 0 });
const agent = await initializeAgentExecutorWithOptions(
  conneryToolkit.tools,
  llm,
  {
    agentType: "zero-shot-react-description",
    verbose: true,
  }
);

const input =
  "Make a short summary of the webpage http://www.paulgraham.com/vb.html in three sentences " +
  "and send it to test@example.com. Include the link to the webpage into the body of the email.";
const result = await agent.invoke({ input });
console.log(result.output);
