import { test, expect } from "@jest/globals";
import { StringOutputParser } from "../../../schema/output_parser.js";
import { OpenAI } from "../../../llms/openai.js";
import { PromptTemplate } from "../../../prompts/index.js";
import { PythonInterpreterTool } from "../pyinterpreter.js";

describe("Python Interpreter testsuite", () => {
  test("hello langchain", async () => {
    const prompt = PromptTemplate.fromTemplate(
      `Can you generate python code that: {input}? Do not generate anything else.`
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

    expect(JSON.parse(result).stdout).toBe("Hello LangChain");
  });
});
