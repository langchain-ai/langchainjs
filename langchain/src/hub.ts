import { Client, ClientConfiguration, HubPushOptions } from "langchainhub";
import { Serializable } from "./load/serializable.js";
import { load } from "./load/index.js";

export async function push(repoFullName: string, serializable: Serializable, options?: HubPushOptions & ClientConfiguration) {
  const client = new Client(options);
  return client.push(repoFullName, JSON.stringify(serializable), options);
}

export async function pull<T extends Serializable>(ownerRepoCommit: string, options?: ClientConfiguration) {
  const client = new Client(options);
  const result = await client.pull(ownerRepoCommit);
  return load<T>(result);
}
