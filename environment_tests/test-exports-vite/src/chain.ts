// Import a few things we'll use to test the exports
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

export function setupChain(element: HTMLButtonElement) {
  const runChain = async () => {
    const llm = new ChatOpenAI({
      // Don't do this in your app, it would leak your API key
      openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
    });

    // Test a chain + prompt + model
    const chain = ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ])
      .pipe(llm)
      .pipe(new StringOutputParser());
    const res = await chain.invoke({ input: "hello" });

    console.log("runChain", res);
  };
  element.addEventListener("click", runChain);
}
