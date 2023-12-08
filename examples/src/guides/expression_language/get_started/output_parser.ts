import { AIMessage } from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";

const outputParser = new StringOutputParser();
const message = new AIMessage(
  'Sure, here you go: Why did the ice cream go to school? Because it wanted to get a little "sundae" education!'
);
const parsed = await outputParser.invoke(message);
console.log(parsed);
/**
Sure, here you go: Why did the ice cream go to school? Because it wanted to get a little "sundae" education!
 */
