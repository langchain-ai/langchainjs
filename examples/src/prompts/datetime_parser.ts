import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DatetimeOutputParser } from "langchain/output_parsers";

const parser = new DatetimeOutputParser();

const prompt = ChatPromptTemplate.fromTemplate(`Answer the users question:

{question}

{format_instructions}`);

const promptWithInstructions = await prompt.partial({
  format_instructions: parser.getFormatInstructions(),
});

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

const chain = promptWithInstructions.pipe(model).pipe(parser);

const response = await chain.invoke({
  question: "When was Chicago incorporated?",
});

console.log(response, response instanceof Date);

/*
  1837-03-04T00:00:00.000Z, true
*/
