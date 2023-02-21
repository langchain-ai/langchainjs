import assert from "assert";
import { OpenAI } from "langchain";
import { loadPrompt } from "langchain/prompts";

assert(typeof OpenAI === "function");
assert(typeof loadPrompt === "function");
