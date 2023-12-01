import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { LLMChain } from "../llm_chain.js";
import { APIChain, APIChainInput } from "../api/api_chain.js";
import {
  API_URL_PROMPT_TEMPLATE,
  API_RESPONSE_PROMPT_TEMPLATE,
} from "../api/prompts.js";
import { OPEN_METEO_DOCS } from "./example_data/open_meteo_docs.js";

const test_api_docs = `
This API endpoint will search the notes for a user.

Endpoint: https://httpbin.org
GET /get

Query parameters:
q | string | The search term for notes
`;

const testApiData = {
  api_docs: test_api_docs,
  question: "Search for notes containing langchain",
  api_url: "https://httpbin.com/api/notes?q=langchain",
  api_response: JSON.stringify({
    success: true,
    results: [{ id: 1, content: "Langchain is awesome!" }],
  }),
  api_summary: "There is 1 note about langchain.",
};

test("Test APIChain", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const apiRequestChain = new LLMChain({
    prompt: API_URL_PROMPT_TEMPLATE,
    llm: model,
  });
  const apiAnswerChain = new LLMChain({
    prompt: API_RESPONSE_PROMPT_TEMPLATE,
    llm: model,
  });

  const apiChainInput: APIChainInput = {
    apiAnswerChain,
    apiRequestChain,
    apiDocs: testApiData.api_docs,
  };

  const chain = new APIChain(apiChainInput);
  const res = await chain.call({
    question: "Search for notes containing langchain",
  });
  console.log({ res });
});

test("Test APIChain fromLLMAndApiDocs", async () => {
  // This test doesn't work as well with earlier models
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = APIChain.fromLLMAndAPIDocs(model, OPEN_METEO_DOCS);
  const res = await chain.call({
    question:
      "What is the weather like right now in Munich, Germany in degrees Farenheit?",
  });
  console.log({ res });
});
