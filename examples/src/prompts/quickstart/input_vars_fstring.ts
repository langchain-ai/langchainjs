import { PromptTemplate } from "@langchain/core/prompts";

const template = "Tell me a {adjective} joke about {content}.";

const promptTemplate = PromptTemplate.fromTemplate(template);
console.log(promptTemplate.inputVariables);
// ['adjective', 'content']
const formattedPromptTemplate = await promptTemplate.format({
  adjective: "funny",
  content: "chickens",
});
console.log(formattedPromptTemplate);
// "Tell me a funny joke about chickens."
