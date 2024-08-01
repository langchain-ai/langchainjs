import { Client } from "langsmith";
import { Runnable } from "@langchain/core/runnables";
import { load } from "./load/index.js";

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
  options?: {
    apiKey?: string;
    apiUrl?: string;
    parentCommitHash?: string;
    newRepoIsPublic?: boolean;
    newRepoDescription?: string;
    readme?: string;
    tags?: string[];
  }
) {
  const client = new Client(options);
  const payloadOptions = {
    object: runnable,
    parentCommitHash: options?.parentCommitHash,
    isPublic: options?.newRepoIsPublic,
    description: options?.newRepoDescription,
    readme: options?.readme,
    tags: options?.tags,
  };
  return client.pushPrompt(repoFullName, payloadOptions);
}

/**
 * Pull a prompt from the hub.
 * @param ownerRepoCommit The name of the repo containing the prompt, as well as an optional commit hash separated by a slash.
 * @param options
 * @returns
 */
export async function pull<T extends Runnable>(
  ownerRepoCommit: string,
  options?: { apiKey?: string; apiUrl?: string; includeModel?: boolean }
) {
  const client = new Client(options);
  const result = await client._pullPrompt(ownerRepoCommit, {
    includeModel: options?.includeModel,
  });
  return load<T>(result);
}
