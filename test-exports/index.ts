import { strict as assert } from "assert";
import { OpenAI } from "langchain";
import { loadPrompt } from "langchain/prompts";

console.log(OpenAI);
console.log(loadPrompt);
assert(typeof OpenAI === "function");
assert(typeof loadPrompt === "function");
