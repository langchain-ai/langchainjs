import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { OpenAIEmbeddings } from "@langchain/openai";
import { CallbackManager } from "@langchain/core/callbacks/manager";

// Test exports
assert(typeof OpenAI === "function");
assert(typeof ChatPromptTemplate === "function");
assert(typeof OpenAIEmbeddings === "function");
assert(typeof CallbackManager === "function");
