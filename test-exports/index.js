const assert = require("assert");
const { OpenAI } = require("../langchain/dist");
const { loadPrompt } = require("../langchain/dist/prompts");

assert(typeof OpenAI === "function");
assert(typeof loadPrompt === "function");
