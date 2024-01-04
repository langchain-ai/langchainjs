import { OpenAI } from "@langchain/openai";
import { PythonInterpreterTool } from "langchain/experimental/tools/pyinterpreter";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const prompt = ChatPromptTemplate.fromTemplate(
  `Generate python code that does {input}. Do not generate anything else.`
);

const model = new OpenAI({});

const interpreter = await PythonInterpreterTool.initialize({
  indexURL: "../node_modules/pyodide",
});
const chain = prompt
  .pipe(model)
  .pipe(new StringOutputParser())
  .pipe(interpreter);

const result = await chain.invoke({
  input: `prints "Hello LangChain"`,
});

console.log(JSON.parse(result).stdout);
