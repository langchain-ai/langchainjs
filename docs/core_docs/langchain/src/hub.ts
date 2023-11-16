import { Client, ClientConfiguration, HubPushOptions } from "langchainhub";
import { load } from "./load/index.js";
import { Runnable } from "./schema/runnable/index.js";

/**
 * Push a prompt to the hub.
 * If the specified repo doesn't already exist, it will be created.
 * @param repoFullName The full name of the repo.
 * @param runnable The prompt to push.
 * @param options
 * @returns The URL of the newly pushed prompt in the hub.
 */
export async function push(
  repoFullName: string,
  runnable: Runnable,
  options?: HubPushOptions & ClientConfiguration
) {
  const client = new Client(options);
  return client.push(repoFullName, JSON.stringify(runnable), options);
}

/**
 * Pull a prompt from the hub.
 * @param ownerRepoCommit The name of the repo containing the prompt, as well as an optional commit hash separated by a slash.
 * @param options
 * @returns
 */
export async function pull<T extends Runnable>(
  ownerRepoCommit: string,
  options?: ClientConfiguration
) {
  const client = new Client(options);
  const result = await client.pull(ownerRepoCommit);
  return load<T>(result);
}
