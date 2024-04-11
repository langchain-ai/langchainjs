import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

// Use a fake model name that will always throw an error
const fakeOpenAIModel = new ChatOpenAI({
  model: "potato!",
  maxRetries: 0,
});

const anthropicModel = new ChatAnthropic({});

const modelWithFallback = fakeOpenAIModel.withFallbacks({
  fallbacks: [anthropicModel],
});

const result = await modelWithFallback.invoke("What is your name?");

console.log(result);

/*
  AIMessage {
    content: ' My name is Claude. I was created by Anthropic.',
    additional_kwargs: {}
  }
*/
