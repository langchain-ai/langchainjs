/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-process-env */
import { env } from "../utils.js";
import { AzureChatOpenAI } from "../../azure/chat_models.js";

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
  delete process.env.AZURE_OPENAI_BASE_PATH;
  delete process.env.AZURE_OPENAI_API_VERSION;
  delete process.env.AZURE_OPENAI_API_COMPLETIONS_DEPLOYMENT_NAME;
  delete process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME;
});

// FIXME: when we have `AZURE_OPENAI_ENDPOINT` in the env, it overrides `azureOpenAIEndpoint` options
env.useVariable("AZURE_OPENAI_ENDPOINT", undefined);

test("Test Azure OpenAI serialization from azure endpoint", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
    azureOpenAIApiDeploymentName: "gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"azure_endpoint":"https://foobar.openai.azure.com/","deployment_name":"gpt-4o","openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]}}}`
  );
});

test("Test Azure OpenAI serialization does not pass along extra params", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
    azureOpenAIApiDeploymentName: "gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
    extraParam: "extra",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"azure_endpoint":"https://foobar.openai.azure.com/","deployment_name":"gpt-4o","openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]}}}`
  );
});

test("Test Azure OpenAI serialization from base path", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIBasePath:
      "https://foobar.openai.azure.com/openai/deployments/gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]},"azure_endpoint":"https://foobar.openai.azure.com","deployment_name":"gpt-4o"}}`
  );
});

test("Test Azure OpenAI serialization from instance name", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIApiInstanceName: "foobar",
    azureOpenAIApiDeploymentName: "gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"azure_open_ai_api_instance_name":"foobar","deployment_name":"gpt-4o","openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]},"azure_endpoint":"https://foobar.openai.azure.com/"}}`
  );
});
