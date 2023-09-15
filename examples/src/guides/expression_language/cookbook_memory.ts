import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { BufferMemory } from "langchain/memory";

const model = new ChatAnthropic();
const prompt = ChatPromptTemplate.fromPromptMessages([
  ["system", "You are a helpful chatbot"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

// Default "inputKey", "outputKey", and "memoryKey values would work here
// but we specify them for clarity.
const memory = new BufferMemory({
  returnMessages: true,
  inputKey: "input",
  outputKey: "output",
  memoryKey: "history",
});

console.log(await memory.loadMemoryVariables({}));

/*
  { history: [] }
*/

const chain = RunnableSequence.from([
  {
    input: (initialInput) => initialInput.input,
    memory: () => memory.loadMemoryVariables({}),
  },
  {
    input: (previousOutput) => previousOutput.input,
    history: (previousOutput) => previousOutput.memory.history,
  },
  prompt,
  model,
]);

const inputs = {
  input: "Hey, I'm Bob!",
};

const response = await chain.invoke(inputs);

console.log(response);

/*
  AIMessage {
    content: " Hi Bob, nice to meet you! I'm Claude, an AI assistant created by Anthropic to be helpful, harmless, and honest.",
    additional_kwargs: {}
  }
*/

await memory.saveContext(inputs, {
  output: response.content,
});

console.log(await memory.loadMemoryVariables({}));

/*
  {
    history: [
      HumanMessage {
        content: "Hey, I'm Bob!",
        additional_kwargs: {}
      },
      AIMessage {
        content: " Hi Bob, nice to meet you! I'm Claude, an AI assistant created by Anthropic to be helpful, harmless, and honest.",
        additional_kwargs: {}
      }
    ]
  }
*/

const inputs2 = {
  input: "What's my name?",
};

const response2 = await chain.invoke(inputs2);

console.log(response2);

/*
  AIMessage {
    content: ' You told me your name is Bob.',
    additional_kwargs: {}
  }
*/
