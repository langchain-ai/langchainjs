import { AzureChatOpenAI } from "../../azure/chat_models.js";

test("Test Azure OpenAI serialization from azure endpoint", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
    azureOpenAIApiDeploymentName: "gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"azure_endpoint":"https://foobar.openai.azure.com/","openai_api_key":{"lc":1,"type":"secret","id":["OPENAI_API_KEY"]},"deployment_name":"gpt-4o"}}`
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
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"openai_api_key":{"lc":1,"type":"secret","id":["OPENAI_API_KEY"]},"azure_endpoint":"https://foobar.openai.azure.com","deployment_name":"gpt-4o"}}`
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
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"openai_api_key":{"lc":1,"type":"secret","id":["OPENAI_API_KEY"]},"azure_endpoint":"https://foobar.openai.azure.com/","deployment_name":"gpt-4o"}}`
  );
});
