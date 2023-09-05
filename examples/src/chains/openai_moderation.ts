import { OpenAIModerationChain, LLMChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";

// A string containing potentially offensive content from the user
const badString = "Bad naughty words from user";

try {
  // Create a new instance of the OpenAIModerationChain
  const moderation = new OpenAIModerationChain({
    throwError: true, // If set to true, the call will throw an error when the moderation chain detects violating content. If set to false, violating content will return "Text was found that violates OpenAI's content policy.".
  });

  // Send the user's input to the moderation chain and wait for the result
  const { output: badResult, results } = await moderation.call({
    input: badString,
  });

  // You can view the category scores of each category. This is useful when dealing with non-english languages, as it allows you to have a more granular control over moderation.
  if (results[0].category_scores["harassment/threatening"] > 0.01) {
    throw new Error("Harassment detected!");
  }

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
