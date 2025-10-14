import { PromptTemplate } from "@langchain/core/prompts";

// An example prompt with no input variables
const noInputPrompt = new PromptTemplate({
  inputVariables: [],
  template: "Tell me a joke.",
});
const formattedNoInputPrompt = await noInputPrompt.format({});

console.log(formattedNoInputPrompt);
// "Tell me a joke."

// An example prompt with one input variable
const oneInputPrompt = new PromptTemplate({
  inputVariables: ["adjective"],
  template: "Tell me a {{adjective}} joke.",
  templateFormat: "mustache",
});
const formattedOneInputPrompt = await oneInputPrompt.format({
  adjective: "funny",
});

console.log(formattedOneInputPrompt);
// "Tell me a funny joke."

// An example prompt with multiple input variables
const multipleInputPrompt = new PromptTemplate({
  inputVariables: ["adjective", "content"],
  template: "Tell me a {{adjective}} joke about {{content}}.",
  templateFormat: "mustache",
});
const formattedMultipleInputPrompt = await multipleInputPrompt.format({
  adjective: "funny",
  content: "chickens",
});

console.log(formattedMultipleInputPrompt);
// "Tell me a funny joke about chickens."
