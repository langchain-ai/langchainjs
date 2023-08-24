import { Client, ClientConfiguration, HubPushOptions } from "langchainhub";
import { load } from "./load/index.js";
import { Runnable } from "./schema/runnable.js";

export async function push(
  repoFullName: string,
  runnable: Runnable,
  options?: HubPushOptions & ClientConfiguration
) {
  const client = new Client(options);
  return client.push(repoFullName, JSON.stringify(runnable), options);
}

export async function pull<T extends Runnable>(
  ownerRepoCommit: string,
  options?: ClientConfiguration
) {
  const client = new Client(options);
  const result = await client.pull(ownerRepoCommit);
  return load<T>(result);
}
