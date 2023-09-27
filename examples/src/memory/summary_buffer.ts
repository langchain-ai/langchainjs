import { OpenAI } from "langchain/llms/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

// summary buffer memory
const memory = new ConversationSummaryBufferMemory({
  llm: new OpenAI({ modelName: "text-davinci-003", temperature: 0 }),
  maxTokenLimit: 10,
});

await memory.saveContext({ input: "hi" }, { output: "whats up" });
await memory.saveContext({ input: "not much you" }, { output: "not much" });
const history = await memory.loadMemoryVariables({});
console.log({ history });
/*
  {
    history: {
      history: 'System: \n' +
        'The human greets the AI, to which the AI responds.\n' +
        'Human: not much you\n' +
        'AI: not much'
    }
  }
*/

// We can also get the history as a list of messages (this is useful if you are using this with a chat prompt).
const chatPromptMemory = new ConversationSummaryBufferMemory({
  llm: new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 }),
  maxTokenLimit: 10,
  returnMessages: true,
});
await chatPromptMemory.saveContext({ input: "hi" }, { output: "whats up" });
await chatPromptMemory.saveContext(
  { input: "not much you" },
  { output: "not much" }
);

// We can also utilize the predict_new_summary method directly.
const messages = await chatPromptMemory.chatHistory.getMessages();
const previous_summary = "";
const predictSummary = await chatPromptMemory.predictNewSummary(
  messages,
  previous_summary
);
console.log(JSON.stringify(predictSummary));

// Using in a chain
// Let's walk through an example, again setting verbose to true so we can see the prompt.
const chatPrompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know."
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

const model = new ChatOpenAI({ temperature: 0.9, verbose: true });
const chain = new ConversationChain({
  llm: model,
  memory: chatPromptMemory,
  prompt: chatPrompt,
});

const res1 = await chain.predict({ input: "Hi, what's up?" });
console.log({ res1 });
/*
  {
    res1: 'Hello! I am an AI language model, always ready to have a conversation. How can I assist you today?'
  }
*/

const res2 = await chain.predict({
  input: "Just working on writing some documentation!",
});
console.log({ res2 });
/*
  {
    res2: "That sounds productive! Documentation is an important aspect of many projects. Is there anything specific you need assistance with regarding your documentation? I'm here to help!"
  }
*/

const res3 = await chain.predict({
  input: "For LangChain! Have you heard of it?",
});
console.log({ res3 });
/*
  {
    res3: 'Yes, I am familiar with LangChain! It is a blockchain-based language learning platform that aims to connect language learners with native speakers for real-time practice and feedback. It utilizes smart contracts to facilitate secure transactions and incentivize participation. Users can earn tokens by providing language learning services or consuming them for language lessons.'
  }
*/

const res4 = await chain.predict({
  input:
    "That's not the right one, although a lot of people confuse it for that!",
});
console.log({ res4 });

/*
  {
    res4: "I apologize for the confusion! Could you please provide some more information about the LangChain you're referring to? That way, I can better understand and assist you with writing documentation for it."
  }
*/
