import { test, expect } from "@jest/globals";
import { StringOutputParser } from "../../schema/output_parser.js";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { PythonInterpreterTool } from "../pyinterpreter.js";

describe("Python Interpreter testsuite", () => {
  test("fibonacci sequence", async () => {
    const prompt = PromptTemplate.fromTemplate(
      `Can you generate python code that: {input}?`
    );

    const model = new OpenAI({});

    const interpreter = new PythonInterpreterTool({
      indexURL: "../node_modules/pyodide",
    });
    const chain = prompt
      .pipe(model)
      .pipe(new StringOutputParser())
      .pipe(interpreter);

    const result = await chain.invoke({
      input: "print the first 10 numbers of the fibonacci sequence",
    });

    expect(JSON.parse(result).stdout).toContain("0112358132134");
  });
});
