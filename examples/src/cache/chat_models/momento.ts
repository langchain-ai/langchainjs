import { ChatOpenAI } from "langchain/chat_models/openai";
import { MomentoCache } from "langchain/cache/momento";
import {
  CacheClient,
  Configurations,
  CredentialProvider,
} from "@gomomento/sdk";

// See https://github.com/momentohq/client-sdk-javascript for connection options
const client = new CacheClient({
  configuration: Configurations.Laptop.v1(),
  credentialProvider: CredentialProvider.fromEnvironmentVariable({
    environmentVariableName: "MOMENTO_AUTH_TOKEN",
  }),
  defaultTtlSeconds: 60 * 60 * 24,
});
const cache = await MomentoCache.fromProps({
  client,
  cacheName: "langchain",
});

const model = new ChatOpenAI({ cache });
