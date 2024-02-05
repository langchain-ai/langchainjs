import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { Dria, DriaParams } from "dria";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export interface DriaRetrieverArgs
  extends DriaParams,
    AsyncCallerParams,
    BaseRetrieverInput {
  topK?: number;
  contractId: string;
}

export class DriaRetriever extends BaseRetriever {
  static lc_name() {
    return "DriaRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "dria"];

  get lc_secrets() {
    return { apiKey: "DRIA_API_KEY" };
  }

  get lc_aliases() {
    return { apiKey: "api_key" };
  }

  caller: AsyncCaller;

  topK?: number;

  apiKey: string;

  driaClient: Dria;

  constructor(fields: DriaRetrieverArgs) {
    super(fields);
    const { contractId, apiKey, topK, ...rest } = fields;

    this.caller = new AsyncCaller(rest);
    const API_KEY = apiKey ?? getEnvironmentVariable("DRIA_API_KEY");
    if (!API_KEY) throw new Error("Missing DRIA_API_KEY.");
    this.apiKey = API_KEY;
    this.driaClient = new Dria({
      apiKey: this.apiKey,
      contractId,
    });
    this.topK = topK;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    return []; // TODO: implement
  }
}
