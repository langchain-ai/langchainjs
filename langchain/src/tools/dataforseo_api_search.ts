import { Buffer } from "buffer";
import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";

export class DataForSeoAPISearch extends Tool {
  protected apiLogin: string;

  protected apiPassword: string;

  protected defaultParams: Record<string, any> = {
    location_name: "United States",
    language_code: "en",
    depth: 10,
    se_name: "google",
    se_type: "organic",
  };

  protected params: Record<string, any> = {};

  protected json_result_types: Array<string> | undefined = undefined;

  protected json_result_fields: Array<string> | undefined = undefined;

  protected top_count: number | undefined = undefined;

  protected use_json_output = false;

  constructor(config: Partial<DataForSeoApiConfig> = {}) {
    super();
    const apiLogin =
      config.apiLogin ?? getEnvironmentVariable("DATAFORSEO_LOGIN");
    const apiPassword =
      config.apiPassword ?? getEnvironmentVariable("DATAFORSEO_PASSWORD");
    const params = config.params ?? {};
    if (!apiLogin || !apiPassword) {
      throw new Error(
        "DataForSEO login or password not set. You can set it as DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in your .env file, or pass it to DataForSeoAPIWrapper."
      );
    }
    this.params = { ...this.defaultParams, ...params };
    this.apiLogin = apiLogin;
    this.apiPassword = apiPassword;
    this.json_result_types = config.json_result_types;
    this.json_result_fields = config.json_result_fields;
    this.use_json_output = config.use_json_output ?? false;
    this.top_count = config.top_count;
  }

  name = "dataforseo-api-wrapper";

  description =
    "A robust Google Search API provided by DataForSeo. This tool is handy when you need information about trending topics or current events.";

  async _call(keyword: string): Promise<string> {
    return this.use_json_output
      ? JSON.stringify(await this.results(keyword))
      : this.processResponse(await this.getResponseJson(keyword));
  }

  async results(keyword: string): Promise<Array<any>> {
    const res = await this.getResponseJson(keyword);
    return this.filterResults(res, this.json_result_types);
  }

  private prepareRequest(keyword: string): {
    url: string;
    headers: any;
    data: any;
  } {
    if (this.apiLogin === undefined || this.apiPassword === undefined) {
      throw new Error("api_login or api_password is not provided");
    }

    const credentials = Buffer.from(
      `${this.apiLogin  }:${  this.apiPassword}`,
      "utf-8"
    ).toString("base64");
    const headers = {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    };
    const obj: any = { keyword: encodeURIComponent(keyword) };
    const mergedParams = { ...obj, ...this.params };
    const data = [mergedParams];

    return {
      url: `https://api.dataforseo.com/v3/serp/${mergedParams.se_name}/${mergedParams.se_type}/live/advanced`,
      headers,
      data,
    };
  }

  private async getResponseJson(url: string): Promise<any> {
    const requestDetails = this.prepareRequest(url);
    const response = await fetch(requestDetails.url, {
      method: "POST",
      headers: requestDetails.headers,
      body: JSON.stringify(requestDetails.data),
    });

    if (!response.ok) {
      throw new Error(
        `Got ${response.status} error from DataForSEO: ${response.statusText}`
      );
    }

    const result = await response.json();
    return this.checkResponse(result);
  }

  private checkResponse(response: any): any {
    if (response.status_code !== 20000) {
      throw new Error(
        `Got error from DataForSEO SERP API: ${response.status_message}`
      );
    }
    return response;
  }

  private filterResults(
    res: any,
    types: Array<string> | undefined
  ): Array<any> {
    const output: Array<any> = [];
    for (const task of res.tasks || []) {
      for (const result of task.result || []) {
        for (const item of result.items || []) {
          if (
            types === undefined ||
            types.length === 0 ||
            types.includes(item.type)
          ) {
            this.cleanupUnnecessaryItems(item);
            if (Object.keys(item).length !== 0) {
              output.push(item);
            }
          }
          if (this.top_count !== undefined && output.length >= this.top_count) {
            break;
          }
        }
      }
    }
    return output;
  }

  /* eslint-disable no-param-reassign */
  private cleanupUnnecessaryItems(d: any) {
    if (this.json_result_fields !== undefined) {
      for (const key in d) {
        if (typeof d[key] === "object" && d[key] !== null) {
          this.cleanupUnnecessaryItems(d[key]);
          if (Object.keys(d[key]).length === 0) {
            delete d[key];
          }
        } else if (!this.json_result_fields.includes(key)) {
          delete d[key];
        }
      }
    }

    ["xpath", "position", "rectangle"].forEach((key) => delete d[key]);
    for (const key in d) {
      if (typeof d[key] === "object" && d[key] !== null) {
        this.cleanupUnnecessaryItems(d[key]);
      }
    }
  }

  private processResponse(res: any): string {
    let toret = "No good search result found";
    for (const task of res.tasks || []) {
      for (const result of task.result || []) {
        const {item_types} = result;
        const items = result.items || [];
        if (item_types.includes("answer_box")) {
          toret = items.find(
            (item: { type: string; text: string }) => item.type === "answer_box"
          ).text;
        } else if (item_types.includes("knowledge_graph")) {
          toret = items.find(
            (item: { type: string; description: string }) =>
              item.type === "knowledge_graph"
          ).description;
        } else if (item_types.includes("featured_snippet")) {
          toret = items.find(
            (item: { type: string; description: string }) =>
              item.type === "featured_snippet"
          ).description;
        } else if (item_types.includes("shopping")) {
          toret = items.find(
            (item: { type: string; price: string }) => item.type === "shopping"
          ).price;
        } else if (item_types.includes("organic")) {
          toret = items.find(
            (item: { type: string; description: string }) =>
              item.type === "organic"
          ).description;
        }
        if (toret) {
          break;
        }
      }
    }
    return toret;
  }
}

export type DataForSeoApiConfig = {
  apiLogin: string | undefined;
  apiPassword: string | undefined;
  params: Record<string, any>;
  use_json_output: boolean;
  json_result_types: Array<string> | undefined;
  json_result_fields: Array<string> | undefined;
  top_count: number | undefined;
};
