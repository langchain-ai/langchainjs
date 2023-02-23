import assert from "assert";
import { OpenAI } from "../langchain/dist/index.mjs";
import { loadPrompt } from "../langchain/dist/prompts/index.mjs";

assert(typeof OpenAI === "function");
assert(typeof loadPrompt === "function");
