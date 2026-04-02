import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogle } from "@langchain/google-gauth";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Test exports
assert(typeof OpenAI === "function");
assert(typeof ChatPromptTemplate === "function");
assert(typeof ChatOllama === "function");
assert(typeof ChatGoogle === "function");
