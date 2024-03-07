/* eslint-disable no-process-env */
import {
  DallEAPIWrapper,
} from "@langchain/openai";

const tool = new DallEAPIWrapper({
  n: 1, // Default
  modelName: "dalle-3", // Default
  openAIApiKey: process.env.OPENAI_API_KEY, // Default
});

const imageURL = await tool.invoke("a painting of a cat");

console.log(imageURL);
