import { checkTreeShaking } from "@langchain/scripts";

checkTreeShaking({
  extraInternals: [/js-tiktoken/],
});
