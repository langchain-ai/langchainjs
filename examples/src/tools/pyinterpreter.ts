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

// Note: In Deno, it may be easier to initialize the interpreter yourself:
// import pyodideModule from "npm:pyodide/pyodide.js";
// import { PythonInterpreterTool } from "npm:langchain/experimental/tools/pyinterpreter";

// const pyodide = await pyodideModule.loadPyodide();
// const pythonTool = new PythonInterpreterTool({instance: pyodide})

const chain = prompt
  .pipe(model)
  .pipe(new StringOutputParser())
  .pipe(interpreter);

const result = await chain.invoke({
  input: `prints "Hello LangChain"`,
});

console.log(JSON.parse(result).stdout);

// To install python packages:
// This uses the loadPackages command.
// This works for packages built with pyodide.
await interpreter.addPackage("numpy");
// But for other packages, you will want to use micropip.
// See: https://pyodide.org/en/stable/usage/loading-packages.html
// for more information
await interpreter.addPackage("micropip");
// The following is roughly equivalent to:
// pyodide.runPython(`import ${pkgname}; ${pkgname}`);
const micropip = interpreter.pyodideInstance.pyimport("micropip");
await micropip.install("numpy");
