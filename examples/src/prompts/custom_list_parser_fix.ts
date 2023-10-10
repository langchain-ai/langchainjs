import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { CustomListOutputParser } from "langchain/output_parsers";

// With a `CustomListOutputParser`, we can parse a list with a specific length and separator.
const parser = new CustomListOutputParser({ 
  // length: 3, 
  separator: "|||" 
});

const formatInstructions = parser.getFormatInstructions();

console.log(`Format Instruction:\n${formatInstructions}`);

// before fix: note the undefined length
// Your response should be a list of undefined items separated by "|" (eg: `foo| bar| baz`)


// I think there may be a bug in the format instruction of ```CustomListOutputParser```
// - length constructor arguments controls the number of lines the user want
// - it may be number or undefined if the user dont want to control the number of lines
// - if length is undefined, the format instructions include "undefined items". 
//
// if length constructor arguments is provided and equals to 3, the format instruction will be:
// Your response should be a list of 3 items separated by "|" (eg: `foo| bar| baz`)
// 
// BEFORE: if length constructor arguments is not provided, the format instruction will be:
// Your response should be a list of undefined items separated by "|" (eg: `foo| bar| baz`)
// 
// AFTER: if length constructor arguments is not provided, the format instruction will be:
// Your response should be a list of items separated by "|" (eg: `foo| bar| baz`)
