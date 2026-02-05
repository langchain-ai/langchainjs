import { PromptTemplate } from "@langchain/core/prompts";

// If a template is passed in, the input variables are inferred automatically from the template.
const prompt = PromptTemplate.fromTemplate(
  `You are a naming consultant for new companies.
What is a good name for a company that makes {product}?`
);

const formattedPrompt = await prompt.format({
  product: "colorful socks",
});

/*
You are a naming consultant for new companies.
What is a good name for a company that makes colorful socks?
*/
