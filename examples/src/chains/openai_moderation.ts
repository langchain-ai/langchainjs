import { OpenAIModerationChain, LLMChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";

// Define an asynchronous function called run
export async function run() {
  // A string containing potentially offensive content from the user
  const badString = "Bad naughty words from user";

  try {
    // Create a new instance of the OpenAIModerationChain
    const moderation = new OpenAIModerationChain();

    // Send the user's input to the moderation chain and wait for the result
    const { output: badResult } = await moderation.call({
      input: badString,
      throwError: true, // If set to true, the call will throw an error when the moderation chain detects violating content. If set to false, violating content will return "Text was found that violates OpenAI's content policy.".
    });

    // If the moderation chain does not detect violating content, it will return the original input and you can proceed to use the result in another chain.
    const model = new OpenAI({ temperature: 0 });
    const template = "Hello, how are you today {person}?";
    const prompt = new PromptTemplate({ template, inputVariables: ["person"] });
    const chainA = new LLMChain({ llm: model, prompt });
    const resA = await chainA.call({ person: badResult });
    console.log({ resA });
  } catch (error) {
    // If an error is caught, it means the input contains content that violates OpenAI TOS
    console.error("Naughty words detected!");
  }
}
