import { LLMChain } from "langchain";
import { ChatOpenAI } from "langchain/chat_models";
import { ZeroShotAgent, AgentExecutor } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";

export const run = async () => {
  const tools = [new SerpAPI()];

  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix: `Answer the following questions as best you can, but speaking as a pirate might speak. You have access to the following tools:`,
    suffix: `Begin! Remember to speak as a pirate when giving your final answer. Use lots of "Args"`,
  });

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(prompt),
    HumanMessagePromptTemplate.fromTemplate(`{input}

This was your previous work (but I haven't seen any of it! I only see what you return as final answer):
{agent_scratchpad}`),
  ]);

  const chat = new ChatOpenAI({});

  const llmChain = new LLMChain({
    prompt: chatPrompt,
    llm: chat,
  });

  const agent = new ZeroShotAgent({
    llmChain,
    allowedTools: tools.map((tool) => tool.name),
  });

  const executor = AgentExecutor.fromAgentAndTools({ agent, tools });

  const response = await executor.run(
    "How many people live in canada as of 2023?"
  );

  console.log(response);
};
