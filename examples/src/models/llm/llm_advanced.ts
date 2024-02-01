import { OpenAI } from "@langchain/openai";

const model = new OpenAI({
  // customize openai model that's used, `gpt-3.5-turbo-instruct` is the default
  modelName: "gpt-3.5-turbo-instruct",

  // `max_tokens` supports a magic -1 param where the max token length for the specified modelName
  //  is calculated and included in the request to OpenAI as the `max_tokens` param
  maxTokens: -1,

  // use `modelKwargs` to pass params directly to the openai call
  // note that OpenAI uses snake_case instead of camelCase
  modelKwargs: {
    user: "me",
  },

  // for additional logging for debugging purposes
  verbose: true,
});

const resA = await model.invoke(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ resA });
// { resA: '\n\nSocktastic Colors' }
