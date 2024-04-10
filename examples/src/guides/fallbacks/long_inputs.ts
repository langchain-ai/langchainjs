import { ChatOpenAI } from "@langchain/openai";

// Use a model with a shorter context window
const shorterLlm = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  maxRetries: 0,
});

const longerLlm = new ChatOpenAI({
  model: "gpt-3.5-turbo-16k",
});

const modelWithFallback = shorterLlm.withFallbacks({
  fallbacks: [longerLlm],
});

const input = `What is the next number: ${"one, two, ".repeat(3000)}`;

try {
  await shorterLlm.invoke(input);
} catch (e) {
  // Length error
  console.log(e);
}

const result = await modelWithFallback.invoke(input);

console.log(result);

/*
  AIMessage {
    content: 'The next number is one.',
    name: undefined,
    additional_kwargs: { function_call: undefined }
  }
*/
