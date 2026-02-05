import fs from "fs/promises";
import {
  ensureAuthOptionScopes,
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
} from "../auth.js";
import { JsonStream } from "../utils/stream.js";
import { GoogleAIBaseLLMInput } from "../types.js";

export function mockId(): string {
  return `mock-id-${Date.now()}`;
}

export async function mockFile(name: string): Promise<string> {
  const filename = `src/tests/data/${name}`;
  return fs.readFile(filename, { encoding: "utf-8" });
}

export interface MockClientAuthInfo {
  record: Record<string, unknown>;
  projectId: string;
  scopes?: string[]; // Just for testing
  resultFile?: string;
}

export function authOptions(
  fields?: GoogleAIBaseLLMInput<MockClientAuthInfo>
): MockClientAuthInfo {
  const options = {
    record: {},
    projectId: `mock-id-${Date.now()}`,
    ...(fields?.authOptions ?? {}),
  };

  return ensureAuthOptionScopes<MockClientAuthInfo>(
    options,
    "scopes",
    fields?.platformType
  );
}

export class MockClient implements GoogleAbstractedClient {
  projectId: string;

  record: Record<string, unknown> = {};

  resultFile: string | undefined = undefined;

  constructor(authOptions?: MockClientAuthInfo) {
    this.projectId = authOptions?.projectId || `mock-id-${Date.now()}`;

    this.record = authOptions?.record ?? {};
    this.resultFile = authOptions?.resultFile;

    // Get the auth options, except for the record field, since that would
    // be a circular reference.
    const authOptionsCopy = { ...(authOptions ?? {}) };
    delete authOptionsCopy.record;
    this.record.authOptions = authOptionsCopy;
  }

  get clientType(): string {
    return "mock";
  }

  async getProjectId(): Promise<string> {
    return Promise.resolve(this.projectId);
  }

  async dataObjectJson(): Promise<unknown> {
    return this.resultFile ? JSON.parse(await mockFile(this.resultFile)) : {};
  }

  async dataObjectStream(): Promise<unknown> {
    const ret = new JsonStream();

    const fileData: string = this.resultFile
      ? await mockFile(this.resultFile)
      : "[]";

    if (fileData === "[]")
      console.warn(`No result file specified. Using empty array.`);

    ret.appendBuffer(fileData);
    ret.closeBuffer();

    return ret;
  }

  async dataObject(responseType: string | undefined): Promise<unknown> {
    switch (responseType) {
      case "json":
        return this.dataObjectJson();
      case "stream":
        return this.dataObjectStream();
      default:
        throw new Error(`Unknown response type: ${responseType}`);
    }
  }

  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    this.record.opts = opts;

    try {
      const data = await this.dataObject(opts.responseType);

      return {
        data,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      };
    } catch (xx) {
      console.error("Error reading file: ", xx);
      throw xx;
    }
  }
}

export class MockClientError extends Error {
  public response: { status: number };

  constructor(status: number) {
    super();
    this.response = { status };
  }
}
