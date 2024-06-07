import { Tool } from "@langchain/core/tools";
import { AccessToken, DefaultAzureCredential } from "@azure/identity";
import { v4 as uuidv4 } from "uuid";
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

let userAgent = "";
async function getuserAgentSuffix(): Promise<string> {
  try {
    if (!userAgent) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const data = await readFile(path.join(__dirname, '..', 'package.json'), 'utf8');
      const json = await JSON.parse(data);
      userAgent = `${json.name}/${json.version} (Language=JavaScript; node.js/${process.version}; ${process.platform}; ${process.arch})`;
    }
  } catch (e) {
    userAgent = "@langchain/azure-dynamic-sessions (Language=JavaScript)";
  }
  return userAgent;
}

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

  _buildUrl(path: string) {
    let url = `${this.poolManagementEndpoint}${this.poolManagementEndpoint.endsWith("/") ? "" : "/"}${path}`;
    url += url.includes("?") ? "&" : "?";
    url += `identifier=${encodeURIComponent(this.sessionId)}`;
    url += `&api-version=2024-02-02-preview`;
    return url;
  }

  async _call(pythonCode: string) {
    const token = await this.accessTokenProvider();
    const apiUrl = this._buildUrl("code/execute");
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "User-Agent": await getuserAgentSuffix(),
    };
    const body = JSON.stringify({
      properties: {
        codeInputType: "inline",
        executionType: "synchronous",
        code: pythonCode,
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
    const properties = json.properties;
    const output = {
      result: properties.result,
      stdout: properties.stdout,
      stderr: properties.stderr,
    };
    return JSON.stringify(output, null, 2);
  }

  async uploadFile(params: { data: Blob, remoteFilename: string }) : Promise<RemoteFile> {
    const token = await this.accessTokenProvider();
    const apiUrl = this._buildUrl("files/upload");
    const headers = {
      "Authorization": `Bearer ${token}`,
      "User-Agent": await getuserAgentSuffix(),
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
    return json["value"][0].properties as RemoteFile;
  }

  async downloadFile(params: { remoteFilename: string }): Promise<Blob> {
    const token = await this.accessTokenProvider();
    const apiUrl = this._buildUrl(`files/content/${params.remoteFilename}`);
    const headers = {
      "Authorization": `Bearer ${token}`,
      "User-Agent": await getuserAgentSuffix(),
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
    const apiUrl = this._buildUrl("files");
    const headers = {
      "Authorization": `Bearer ${token}`,
      "User-Agent": await getuserAgentSuffix(),
    };

    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    const list = json["value"].map((x: any) => x.properties);
    return list as RemoteFile[];
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