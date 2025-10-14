import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

// We can construct an LLMChain from a PromptTemplate and an LLM.
const model = new OpenAI({ temperature: 0 });
const prompt = PromptTemplate.fromTemplate(
  "What is a good name for a company that makes {product}?"
);

const chainA = prompt.pipe({ llm: model });

// The result is an object with a `text` property.
const resA = await chainA.invoke({ product: "colorful socks" });
console.log({ resA });
// { resA: { text: '\n\nSocktastic!' } }
