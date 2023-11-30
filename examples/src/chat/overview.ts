import { AgentExecutor, ChatAgent } from "langchain/agents";
import { ConversationChain, LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { BufferMemory } from "langchain/memory";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { HumanMessage, SystemMessage } from "langchain/schema";
import { SerpAPI } from "langchain/tools";

export const run = async () => {
  const chat = new ChatOpenAI({ temperature: 0 });

  // Sending one message to the chat model, receiving one message back

  let response = await chat.call([
    new HumanMessage(
      "Translate this sentence from English to French. I love programming."
    ),
  ]);

  console.log(response);

  // Sending an input made up of two messages to the chat model

  response = await chat.call([
    new SystemMessage(
      "You are a helpful assistant that translates English to French."
    ),
    new HumanMessage("Translate: I love programming."),
  ]);

  console.log(response);

  // Sending two separate prompts in parallel, receiving two responses back

  const responseA = await chat.generate([
    [
      new SystemMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanMessage(
        "Translate this sentence from English to French. I love programming."
      ),
    ],
    [
      new SystemMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanMessage(
        "Translate this sentence from English to French. I love artificial intelligence."
      ),
    ],
  ]);

  console.log(responseA);

  // Using ChatPromptTemplate to encapsulate the reusable parts of the prompt

  const translatePrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful assistant that translates {input_language} to {output_language}."
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseB = await chat.callPrompt(
    await translatePrompt.formatPromptValue({
      input_language: "English",
      output_language: "French",
      text: "I love programming.",
    })
  );

  console.log(responseB);

  // This pattern of asking for the completion of a formatted prompt is quite
  // common, so we introduce the next piece of the puzzle: LLMChain

  const translateChain = new LLMChain({
    prompt: translatePrompt,
    llm: chat,
  });

  const responseC = await translateChain.call({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });

  console.log(responseC);

  // Next up, stateful chains that remember the conversation history

  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know."
    ),
    new MessagesPlaceholder("history"),
    HumanMessagePromptTemplate.fromTemplate("{input}"),
  ]);

  const chain = new ConversationChain({
    memory: new BufferMemory({ returnMessages: true }),
    prompt: chatPrompt,
    llm: chat,
  });

  const responseE = await chain.call({
    input: "hi from London, how are you doing today",
  });

  console.log(responseE);

  const responseF = await chain.call({
    input: "Do you know where I am?",
  });

  console.log(responseF);

  // Finally, we introduce Tools and Agents, which extend the model with
  // other abilities, such as search, or a calculator

  // Define the list of tools the agent can use
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
  ];
  // Create the agent from the chat model and the tools
  const agent = ChatAgent.fromLLMAndTools(new ChatOpenAI(), tools);
  // Create an executor, which calls to the agent until an answer is found
  const executor = AgentExecutor.fromAgentAndTools({ agent, tools });

  const responseG = await executor.invoke({
    input: "How many people live in canada as of 2023?",
  });

  console.log(responseG);
};
