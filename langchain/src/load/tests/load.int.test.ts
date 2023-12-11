import { test, expect } from "@jest/globals";
import { RunnableSequence } from "@langchain/core/runnables";

import { load } from "../index.js";

test("Should load and invoke real-world serialized chain", async () => {
  const serializedValue = `{"lc": 1, "type": "constructor", "id": ["langchain_core", "runnables", "RunnableSequence"], "kwargs": {"first": {"lc": 1, "type": "constructor", "id": ["langchain_core", "runnables", "RunnableParallel"], "kwargs": {"steps": {"equation_statement": {"lc": 1, "type": "constructor", "id": ["langchain_core", "runnables", "RunnablePassthrough"], "kwargs": {"func": null, "afunc": null, "input_type": null}}}}}, "middle": [{"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "chat", "ChatPromptTemplate"], "kwargs": {"input_variables": ["equation_statement"], "messages": [{"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "chat", "SystemMessagePromptTemplate"], "kwargs": {"prompt": {"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "prompt", "PromptTemplate"], "kwargs": {"input_variables": [], "template": "Write out the following equation using algebraic symbols then solve it. Use the format\\n\\nEQUATION:...\\nSOLUTION:...\\n\\n", "template_format": "f-string", "partial_variables": {}}}}}, {"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "chat", "HumanMessagePromptTemplate"], "kwargs": {"prompt": {"lc": 1, "type": "constructor", "id": ["langchain_core", "prompts", "prompt", "PromptTemplate"], "kwargs": {"input_variables": ["equation_statement"], "template": "{equation_statement}", "template_format": "f-string", "partial_variables": {}}}}}]}}, {"lc": 1, "type": "constructor", "id": ["langchain", "chat_models", "openai", "ChatOpenAI"], "kwargs": {"temperature": 0.0, "openai_api_key": {"lc": 1, "type": "secret", "id": ["OPENAI_API_KEY"]}}}], "last": {"lc": 1, "type": "constructor", "id": ["langchain_core", "output_parsers", "string", "StrOutputParser"], "kwargs": {}}}}`;
  const chain = await load<RunnableSequence>(serializedValue);
  const result = await chain.invoke(
    "x raised to the third plus seven equals 12"
  );
  console.log(result);
  expect(typeof result).toBe("string");
});
