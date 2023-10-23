import { ChatOpenAI } from "langchain/chat_models/openai";
import { StringOutputParser } from "langchain/schema/output_parser";

const parser = new StringOutputParser();

const model = new ChatOpenAI({ temperature: 0 });

const stream = await model.pipe(parser).stream("Hello there!");

for await (const chunk of stream) {
  console.log(chunk);
}

/*
  Hello
  !
  How
  can
  I
  assist
  you
  today
  ?
*/
