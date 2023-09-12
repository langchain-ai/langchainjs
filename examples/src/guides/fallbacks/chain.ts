import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAI } from "langchain/llms/openai";
import { StringOutputParser } from "langchain/schema/output_parser";
import { ChatPromptTemplate, PromptTemplate } from "langchain/prompts";

const chatPrompt = ChatPromptTemplate.fromPromptMessages<{ animal: string }>([
  [
    "system",
    "You're a nice assistant who always includes a compliment in your response",
  ],
  ["human", "Why did the {animal} cross the road?"],
]);

// Use a fake model name that will always throw an error
const fakeOpenAIChatModel = new ChatOpenAI({
  modelName: "potato!",
  maxRetries: 0,
});

const prompt =
  PromptTemplate.fromTemplate(`Instructions: You should always include a compliment in your response.

Question: Why did the {animal} cross the road?

Answer:`);

const openAILLM = new OpenAI({});

const outputParser = new StringOutputParser();

const badChain = chatPrompt.pipe(fakeOpenAIChatModel).pipe(outputParser);

const goodChain = prompt.pipe(openAILLM).pipe(outputParser);

const chain = badChain.withFallbacks({
  fallbacks: [goodChain],
});

const result = await chain.invoke({
  animal: "dragon",
});

console.log(result);

/*
  I don't know, but I'm sure it was an impressive sight. You must have a great imagination to come up with such an interesting question!
*/
