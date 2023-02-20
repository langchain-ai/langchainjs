const assert = require("assert");
const { OpenAI } = require("langchain");
const { loadPrompt } = require("langchain/prompts");

assert(typeof OpenAI === "function");
assert(typeof loadPrompt === "function");
