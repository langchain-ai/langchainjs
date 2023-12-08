import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";

const prompt = ChatPromptTemplate.fromMessages([
  ["human", "Tell me a short joke about {topic}"],
]);
const model = new ChatOpenAI({});
const outputParser = new StringOutputParser();

const chain = prompt.pipe(model).pipe(outputParser);

const response = await chain.invoke({
  topic: "ice cream",
});
console.log(response);
/**
Why did the ice cream go to the gym?
Because it wanted to get a little "cone"ditioning!
 */
