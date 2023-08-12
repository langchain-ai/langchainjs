import { ChatOpenAI } from "langchain/chat_models/openai";
import { BytesOutputParser } from "langchain/schema/output_parser";

const parser = new BytesOutputParser();

const model = new ChatOpenAI({ temperature: 0 });

const stream = await model.pipe(parser).stream("Hello there!");

const decoder = new TextDecoder();

for await (const chunk of stream) {
  if (chunk) {
    console.log(decoder.decode(chunk));
  }
}
