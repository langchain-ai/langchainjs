import { URL } from "url";
import { RunResult } from "../callbacks/handlers/tracers.js";
import { RunInputs, RunOutputs } from "../schema/index.js";

export interface BaseDataset {
  name: string;
  description: string;
  tenant_id: string;
}

export interface Dataset extends BaseDataset {
  id: string;
  created_at: string;
  modified_at: string;
}

export interface BaseExample {
  dataset_id: string;
  inputs: RunInputs;
  outputs: RunOutputs;
}

export interface ExampleCreate extends BaseExample {
  id?: string;
  created_at: string;
}

export interface Example extends BaseExample {
  id: string;
  created_at: string;
  modified_at: string;
  runs: RunResult[];
}

// utility functions
const isLocalhost = (url: string): boolean => {
  const { hostname } = new URL(url);
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
};

const getSeededTenantId = async (
  apiUrl: string,
  apiKey: string | undefined
): Promise<string> => {
  // Get the tenant ID from the seeded tenant
  const url = `${apiUrl}/tenants`;
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
    });
  } catch (err) {
    throw new Error("Unable to get seeded tenant ID. Please manually provide.");
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch seeded tenant ID: ${response.status} ${response.statusText}`
    );
  }
  const tenants = await response.json();
  if (!Array.isArray(tenants)) {
    throw new Error(
      `Expected tenants GET request to return an array, but got ${tenants}`
    );
  }
  if (tenants.length === 0) {
    throw new Error("No seeded tenant found");
  }

  return tenants[0].id;
};

export class LangChainPlusClient {
  private apiKey?: string;

  private apiUrl: string;

  private tenantId: string;

  constructor(apiUrl: string, tenantId: string, apiKey?: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.tenantId = tenantId;
    this.validateApiKeyIfHosted();
  }

  public static async create(
    apiUrl: string,
    apiKey: string | undefined = undefined,
    tenantId: string | undefined = undefined
  ): Promise<LangChainPlusClient> {
    let tenantId_ = tenantId;
    if (!tenantId_) {
      tenantId_ = await getSeededTenantId(apiUrl, apiKey);
    }
    return new LangChainPlusClient(apiUrl, tenantId_, apiKey);
  }

  private validateApiKeyIfHosted(): void {
    const isLocal = isLocalhost(this.apiUrl);
    if (!isLocal && !this.apiKey) {
      throw new Error(
        "API key must be provided when using hosted LangChain+ API"
      );
    }
  }

  private get headers(): { [header: string]: string } {
    const headers: { [header: string]: string } = {};
    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private get queryParams(): { [param: string]: string } {
    return { tenant_id: this.tenantId };
  }

  private async _get<T>(
    path: string,
    queryParams: { [param: string]: string } = {}
  ): Promise<T> {
    const params = { ...this.queryParams, ...queryParams };
    const url = new URL(path, this.apiUrl);
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${path}: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as T;
  }

  public async uploadCsv(
    csvFile: Blob,
    fileName: string,
    description: string,
    inputKeys: string[],
    outputKeys: string[]
  ): Promise<Dataset> {
    const url = new URL("/datasets/upload", this.apiUrl);
    const formData = new FormData();
    formData.append("file", csvFile, fileName);
    formData.append("input_keys", inputKeys.join(","));
    formData.append("output_keys", outputKeys.join(","));
    formData.append("description", description);
    formData.append("tenant_id", this.tenantId);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.headers,
      body: formData,
    });

    if (!response.ok) {
      const result = await response.json();
      if (result.detail && result.detail.includes("already exists")) {
        throw new Error(`Dataset ${fileName} already exists`);
      }
      throw new Error(
        `Failed to upload CSV: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return result as Dataset;
  }

  public async readDataset(
    datasetId: string | undefined,
    datasetName: string | undefined
  ): Promise<Dataset> {
    let path = "/datasets";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: { [param: string]: any } = { limit: 1 };
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId !== undefined) {
      path += `/${datasetId}`;
    } else if (datasetName !== undefined) {
      params.name = datasetName;
    } else {
      throw new Error("Must provide datasetName or datasetId");
    }

    const response = await this._get<Dataset | Dataset[]>(path, params);
    let result: Dataset;
    if (Array.isArray(response)) {
      if (response.length === 0) {
        throw new Error(
          `Dataset[id=${datasetId}, name=${datasetName}] not found`
        );
      }
      result = response[0] as Dataset;
    } else {
      result = response as Dataset;
    }
    return result;
  }

  public async listDatasets(limit = 100): Promise<Dataset[]> {
    const path = "/datasets";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: { [param: string]: any } = { limit };
    const response = await this._get<Dataset[]>(path, params);
    if (!Array.isArray(response)) {
      throw new Error(
        `Expected ${path} to return an array, but got ${response}`
      );
    }
    return response as Dataset[];
  }

  public async deleteDataset(
    datasetId: string | undefined,
    datasetName: string | undefined
  ): Promise<Dataset> {
    let path = "/datasets";
    let datasetId_ = datasetId;
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetName !== undefined) {
      const dataset = await this.readDataset(undefined, datasetName);
      datasetId_ = dataset.id;
    }
    if (datasetId_ !== undefined) {
      path += `/${datasetId_}`;
    } else {
      throw new Error("Must provide datasetName or datasetId");
    }
    const url = new URL(path, this.apiUrl);
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to delete ${path}: ${response.status} ${response.statusText}`
      );
    }
    const results = await response.json();
    return results as Dataset;
  }

  public async createExample(
    inputs: RunInputs,
    outputs: RunOutputs = {},
    datasetId: string | undefined = undefined,
    datasetName: string | undefined = undefined,
    createdAt: Date | undefined = undefined
  ): Promise<Example> {
    let datasetId_ = datasetId;
    if (datasetId_ === undefined && datasetName === undefined) {
      throw new Error("Must provide either datasetName or datasetId");
    } else if (datasetId_ !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId_ === undefined) {
      const dataset = await this.readDataset(undefined, datasetName);
      datasetId_ = dataset.id;
    }

    const createdAt_ = createdAt || new Date();
    const data: ExampleCreate = {
      dataset_id: datasetId_,
      inputs,
      outputs,
      created_at: createdAt_.toISOString(),
    };

    const url = new URL("/examples", this.apiUrl);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create example: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return result as Example;
  }

  public async readExample(exampleId: string): Promise<Example> {
    const path = `/examples/${exampleId}`;
    return await this._get<Example>(path);
  }

  public async listExamples(
    datasetId: string | undefined = undefined,
    datasetName: string | undefined = undefined
  ): Promise<Example[]> {
    let datasetId_;
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId !== undefined) {
      datasetId_ = datasetId;
    } else if (datasetName !== undefined) {
      const dataset = await this.readDataset(undefined, datasetName);
      datasetId_ = dataset.id;
    } else {
      throw new Error("Must provide a datasetName or datasetId");
    }
    const response = await this._get<Example[]>("/examples", {
      dataset: datasetId_,
    });
    if (!Array.isArray(response)) {
      throw new Error(
        `Expected /examples to return an array, but got ${response}`
      );
    }
    return response as Example[];
  }

  public async deleteExample(exampleId: string): Promise<Example> {
    const path = `/examples/${exampleId}`;
    const url = new URL(path, this.apiUrl);
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to delete ${path}: ${response.status} ${response.statusText}`
      );
    }
    const result = await response.json();
    return result as Example;
  }
}
