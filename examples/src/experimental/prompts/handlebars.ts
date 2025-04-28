import { HandlebarsPromptTemplate } from "langchain/experimental/prompts/handlebars";
import { ChatAnthropic } from "@langchain/anthropic";
import { StringOutputParser } from "@langchain/core/output_parsers";

const template = `Tell me a joke about {{topic}}`;

const prompt = HandlebarsPromptTemplate.fromTemplate(template);

const formattedResult = await prompt.invoke({ topic: "bears" });

console.log(formattedResult);

/*
  StringPromptValue {
    value: 'Tell me a joke about bears'
  }
*/

const model = new ChatAnthropic();

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const result = await chain.invoke({
  topic: "bears",
});

console.log(result);

/*
  Why did the bears dissolve their hockey team? Because there were too many grizzly fights!
*/
