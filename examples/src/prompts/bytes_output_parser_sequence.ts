import { ChatOpenAI } from "langchain/chat_models/openai";
import { BytesOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";

const chain = RunnableSequence.from([
  new ChatOpenAI({ temperature: 0 }),
  new BytesOutputParser(),
]);

const stream = await chain.stream("Hello there!");

const decoder = new TextDecoder();

for await (const chunk of stream) {
  if (chunk) {
    console.log(decoder.decode(chunk));
  }
}
