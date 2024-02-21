import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
});
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"],
]);
const outputParser = new StringOutputParser();
const chain = prompt.pipe(model).pipe(outputParser);
const response = await chain.stream({
  input: "Hello",
});
let res = "";
for await (const item of response) {
  res += item;
  console.log("stream:", res);
}
/**
stream: Hello
stream: Hello!
stream: Hello! I
stream: Hello! I'
stream: Hello! I'm
stream: Hello! I'm happy
stream: Hello! I'm happy to
stream: Hello! I'm happy to assist
stream: Hello! I'm happy to assist you
stream: Hello! I'm happy to assist you in
stream: Hello! I'm happy to assist you in any
stream: Hello! I'm happy to assist you in any way
stream: Hello! I'm happy to assist you in any way I
stream: Hello! I'm happy to assist you in any way I can
stream: Hello! I'm happy to assist you in any way I can.
stream: Hello! I'm happy to assist you in any way I can. Is
stream: Hello! I'm happy to assist you in any way I can. Is there
stream: Hello! I'm happy to assist you in any way I can. Is there something
stream: Hello! I'm happy to assist you in any way I can. Is there something specific
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help with
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help with or
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help with or a
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help with or a question
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help with or a question you
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help with or a question you have
stream: Hello! I'm happy to assist you in any way I can. Is there something specific you need help with or a question you have?
 */
