import { ConneryService } from "@langchain/community/tools/connery";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";

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
const manualRunResult = await sendEmailAction.call({
  recipient: recepientEmail,
  subject: "Test email",
  body: "This is a test email sent by Connery.",
});
console.log(manualRunResult);

// Run the action using the OpenAI Functions agent.
const llm = new ChatOpenAI({ temperature: 0 });
const agent = await initializeAgentExecutorWithOptions([sendEmailAction], llm, {
  agentType: "openai-functions",
  verbose: true,
});
const agentRunResult = await agent.invoke({
  input:
    `Send an email to ${recepientEmail} with the subject 'Test email' ` +
    `and the body 'This is a test email sent by Connery using the OpenAI Functions agent.'`,
});
console.log(agentRunResult);
