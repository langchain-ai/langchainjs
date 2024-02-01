import { test, expect } from "@jest/globals";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
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
