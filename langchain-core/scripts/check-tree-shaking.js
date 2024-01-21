import { checkTreeShaking } from "@langchain/scripts";

checkTreeShaking({
  extraInternals: [/node\:/, /js-tiktoken/],
});
