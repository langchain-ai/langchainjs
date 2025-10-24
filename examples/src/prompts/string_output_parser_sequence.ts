import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
  new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  new StringOutputParser(),
]);

const stream = await chain.stream("Hello there!");

for await (const chunk of stream) {
  console.log(chunk);
}
