import { LLMChain } from "langchain/chains";
import { OpenAI } from "@langchain/openai";
import {
  CallbackManager,
  traceAsGroup,
  TraceGroup,
} from "@langchain/core/callbacks/manager";
import { PromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  // Initialize the LLMChain
  const llm = new OpenAI({ temperature: 0.9 });
  const prompt = new PromptTemplate({
    inputVariables: ["question"],
    template: "What is the answer to {question}?",
  });
  const chain = new LLMChain({ llm, prompt });

  // You can group runs together using the traceAsGroup function
  const blockResult = await traceAsGroup(
    { name: "my_group_name" },
    async (manager: CallbackManager, questions: string[]) => {
      await chain.invoke({ question: questions[0] }, manager);
      await chain.invoke({ question: questions[1] }, manager);
      const finalResult = await chain.invoke(
        { question: questions[2] },
        manager
      );
      return finalResult;
    },
    [
      "What is your name?",
      "What is your quest?",
      "What is your favorite color?",
    ]
  );
  // Or you can manually control the start and end of the grouped run
  const traceGroup = new TraceGroup("my_group_name");
  const groupManager = await traceGroup.start();
  try {
    await chain.invoke({ question: "What is your name?" }, groupManager);
    await chain.invoke({ question: "What is your quest?" }, groupManager);
    await chain.invoke(
      { question: "What is the airspeed velocity of an unladen swallow?" },
      groupManager
    );
  } finally {
    // Code goes here
    await traceGroup.end();
  }
};
