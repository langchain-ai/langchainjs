import { ConneryService } from "@langchain/community/tools/connery";
import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

// Specify your Connery Runner credentials.
process.env.CONNERY_RUNNER_URL = "";
process.env.CONNERY_RUNNER_API_KEY = "";

// Specify OpenAI API key.
process.env.OPENAI_API_KEY = "";

// Specify your email address to receive the emails from examples below.
const recepientEmail = "test@example.com";

// Get the SendEmail action from the Connery Runner by ID.
const conneryService = new ConneryService();
const sendEmailAction = await conneryService.getAction(
  "CABC80BB79C15067CA983495324AE709"
);

// Run the action manually.
const manualRunResult = await sendEmailAction.invoke({
  recipient: recepientEmail,
  subject: "Test email",
  body: "This is a test email sent by Connery.",
});
console.log(manualRunResult);

// Run the action using the OpenAI Functions agent.
const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
const agent = await initializeAgentExecutorWithOptions([sendEmailAction], llm, {
  agentType: "openai-functions",
  verbose: true,
});
const agentRunResult = await agent.invoke({
  input: `Send an email to the ${recepientEmail} and say that I will be late for the meeting.`,
});
console.log(agentRunResult);
