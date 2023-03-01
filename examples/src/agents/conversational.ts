import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import { SerpAPI, Calculator } from "langchain/tools";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const tools = [new SerpAPI(), new Calculator()];

  // todo need to be able to edit the prompts too
  const executor = await initializeAgentExecutor(
    tools,
    model,
    "conversational-react-description"
  );
  console.log("Loaded agent.");

  const input = `hi, i am bob`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input, chat_history: [] });

  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );

  const chatHistory = input + result.text;

  const input2 = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  console.log(`Executing with input "${input2}"...`);

  const result2 = await executor.call({
    input: input2,
    chat_history: chatHistory,
  });

  console.log(`Got output ${result2.output}`);
};
