import { ChatOpenAI } from "@langchain/openai";
import { BytesOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
  new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
  new BytesOutputParser(),
]);

const stream = await chain.stream("Hello there!");

const decoder = new TextDecoder();

for await (const chunk of stream) {
  if (chunk) {
    console.log(decoder.decode(chunk));
  }
}
