import { LodashPromptTemplate } from "langchain/experimental/prompts/lodash";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";

const template = `Tell me a joke about {{topic}}`;

const prompt = LodashPromptTemplate.fromTemplate(template);

const formattedResult = await prompt.invoke({ topic: "bears" });

console.log(formattedResult);

/*
  StringPromptValue {
    value: 'Tell me a joke about bears'
  }
*/

const model = new ChatOpenAI();

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const result = await chain.invoke({
  topic: "bears",
});

console.log(result);

/*
  Why did the bears dissolve their hockey team? Because there were too many grizzly fights!
*/
