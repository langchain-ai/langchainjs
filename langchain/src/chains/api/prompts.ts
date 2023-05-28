/* eslint-disable spaced-comment */
import { PromptTemplate } from "../../prompts/prompt.js";

export const API_URL_RAW_PROMPT_TEMPLATE = `You are given the below API Documentation:
{api_docs}

<< FORMATTING >>
Return a JSON string with a JSON object formatted to look like:
  {{
    "api_url": string \\ the formatted url in case of GET API call otherwise just the url
    "api_body": key value \\ formatted key value pair for making API call
    "api_method": string \\ API method from documentation 
  }}

REMEMBER: "api_url" Must be a valid url and should be along with parameters incase of GET API call only
REMEMBER: "api_body" Should be a valid JSON in case of POST or PUT api call

You should build the json string in order to get a response that is as short as possible, while still getting the necessary information 
to answer the question. Pay attention to deliberately exclude any unnecessary pieces of data in the API call.
Question: {question}
json:
`;

export const API_URL_PROMPT_TEMPLATE = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["api_docs", "question"],
  template: API_URL_RAW_PROMPT_TEMPLATE,
});

export const API_RESPONSE_RAW_PROMPT_TEMPLATE = `${API_URL_RAW_PROMPT_TEMPLATE} {api_url}

Here is the response from the API:

{api_response}

Summarize this response to answer the original question.

Summary:`;
export const API_RESPONSE_PROMPT_TEMPLATE = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["api_docs", "question", "api_url", "api_response"],
  template: API_RESPONSE_RAW_PROMPT_TEMPLATE,
});
