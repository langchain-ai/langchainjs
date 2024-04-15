import { Tool } from "@langchain/core/tools";
import { AccessToken, DefaultAzureCredential } from "@azure/identity";
import { v4 as uuidv4 } from "uuid";

export interface SessionsPythonREPLToolParams {
  /**
   * The endpoint of the pool management service.
   */
  poolManagementEndpoint: string;
  
  /**
   * The session ID. If not provided, a new session ID will be generated.
   */
  sessionId?: string;

  /**
   * A function that returns the access token to be used for authentication.
   * If not provided, a default implementation that uses the DefaultAzureCredential
   * will be used.
   * 
   * @returns The access token to be used for authentication.
   */
  accessTokenProvider?: () => Promise<string>;
}

/*
      {
        '$id': '2',
        filename: 'test.txt',
        size: 12,
        last_modified_time: '2024-04-15T06:56:28.7042752Z'
      }
      */
export interface RemoteFile {
  /**
   * The filename of the file.
   */
  filename: string;

  /**
   * The size of the file in bytes.
   */
  size: number;

  /**
   * The last modified time of the file.
   */
  last_modified_time: string;

  /**
   * The identifier of the file.
   */
  $id: string;
}


export class SessionsPythonREPLTool extends Tool {
  static lc_name() {
    return "SessionsPythonREPLTool";
  }

  name = "sessions-python-repl-tool";

  description = "A Python shell. Use this to execute python commands " +
    "when you need to perform calculations or computations. " +
    "Input should be a valid python command. " +
    "Returns the result, stdout, and stderr. ";

  poolManagementEndpoint: string;
  sessionId: string;
  accessTokenProvider: () => Promise<string>;

  constructor(params: SessionsPythonREPLToolParams) {
    super();

    if (!params.poolManagementEndpoint) {
      throw new Error("poolManagementEndpoint is required.");
    }
    this.poolManagementEndpoint = params.poolManagementEndpoint;

    this.sessionId = params.sessionId ?? uuidv4();

    if (params.accessTokenProvider) {
      this.accessTokenProvider = params.accessTokenProvider;
    } else {
      this.accessTokenProvider = defaultAccessTokenProviderFactory();
    }
  }

  async _call(pythonCode: string) {
    const credentials = new DefaultAzureCredential();
    const token = await credentials.getToken("https://acasessions.io/.default");
    const apiUrl = `${this.poolManagementEndpoint}python/execute`;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token.token}`,
    };
    const body = JSON.stringify({
      properties: {
        identifier: this.sessionId,
        codeInputType: "inline",
        executionType: "synchronous",
        pythonCode,
      }
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    const output = `Result:\n${json.result}\n\nStdout:\n${json.stdout}\n\nStderr:\n${json.stderr}`;
    // console.log(output);
    return output;
  }

  async uploadFile(params: { data: Blob, remoteFilename: string }) : Promise<RemoteFile> {
    const token = await this.accessTokenProvider();
    const apiUrl = `${this.poolManagementEndpoint}python/uploadFile?identifier={self.session_id}`;
    const headers = {
      "Authorization": `Bearer ${token}`,
    };
    const formData = new FormData();
    formData.append("file", params.data, params.remoteFilename);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return json["$values"][0] as RemoteFile;
  }

  async downloadFile(params: { remoteFilename: string }): Promise<Blob> {
    const token = await this.accessTokenProvider();
    const apiUrl = `${this.poolManagementEndpoint}python/downloadFile?identifier={self.session_id}&filename=${params.remoteFilename}`;
    const headers = {
      "Authorization": `Bearer ${token}`,
    };

    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  async listFiles() : Promise<RemoteFile[]> {
    const token = await this.accessTokenProvider();
    const apiUrl = `${this.poolManagementEndpoint}python/files?identifier={self.session_id}`;
    const headers = {
      authorization: `Bearer ${token}`,
    };

    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json())["$values"] as RemoteFile[];
  }
}

function defaultAccessTokenProviderFactory() {
  let cachedToken: AccessToken | undefined;
  return async () => {
    const credentials = new DefaultAzureCredential();
    if (!cachedToken || cachedToken.expiresOnTimestamp < Date.now() + (5 * 60 * 1000)) {
      cachedToken = await credentials.getToken("https://acasessions.io/.default");
    }
    return cachedToken.token;
  };
}