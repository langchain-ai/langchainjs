import { ChatOpenAI } from "langchain/chat_models/openai";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";

const chain = RunnableSequence.from([
  new ChatOpenAI({ temperature: 0 }),
  new StringOutputParser(),
]);

const stream = await chain.stream("Hello there!");

for await (const chunk of stream) {
  console.log(chunk);
}
