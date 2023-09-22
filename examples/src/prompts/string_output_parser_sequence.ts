import { ChatOpenAI } from "langchain/chat_models/openai";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";

const stream = await RunnableSequence.from([
  new ChatOpenAI({ temperature: 0 }),
  new StringOutputParser(),
]).stream("Hello there!");

for await (const chunk of stream) {
  console.log(chunk);
}
