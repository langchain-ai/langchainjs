import { Tool } from "@langchain/core/tools";

export interface StackExchangeAnswer {
  items: StackExchangeItem[];
  has_more: boolean;
  quota_max: number;
  quota_remaining: number;
}

export interface StackExchangeItem {
  tags: string[];
  question_score: number;
  is_accepted: boolean;
  has_accepted_answer?: boolean;
  answer_count?: number;
  is_answered: boolean;
  question_id: number;
  item_type: string;
  score: number;
  last_activity_date: number;
  creation_date: number;
  body: string;
  excerpt: string;
  title: string;
  answer_id?: number;
}

type StackExchangeOptions = Record<string, string | number | boolean>;

export interface StackExchangeAPIParams {
  /**
   * The maximum number of results to return from the search.
   * Limiting to 10 to avoid context overload.
   * @default 3
   */
  maxResult?: number;
  /**
   * Which part of StackOverflows items to match against. One of 'all', 'title',
   * 'body'.
   * @default "all"
   */
  queryType?: "all" | "title" | "body";
  /**
   * Additional params to pass to the StackExchange API
   */
  options?: StackExchangeOptions;
  /**
   * Separator between question,answer pairs.
   * @default "\n\n"
   */
  resultSeparator?: string;
}

/**
 * Class for interacting with the StackExchange API
 * It extends the base Tool class to perform retrieval.
 */
export class StackExchangeAPI extends Tool {
  name = "stackexchange";

  description = "Stack Exchange API Implementation";

  private pageSize: number;

  private maxResult = 3;

  private key: string | null;

  private accessToken: string | null;

  private site = "stackoverflow";

  private version = "2.3";

  private baseUrl = "https://api.stackexchange.com";

  private queryType = "all";

  private options?: StackExchangeOptions = {};

  private resultSeparator?: string = "\n\n";

  constructor(params: StackExchangeAPIParams = {}) {
    const { maxResult, queryType = "all", options, resultSeparator } = params;
    super();
    this.maxResult = maxResult || this.maxResult;
    this.pageSize = 100;
    this.baseUrl = `${this.baseUrl}/${this.version}/`;
    this.queryType = queryType === "all" ? "q" : queryType;
    this.options = options || this.options;
    this.resultSeparator = resultSeparator || this.resultSeparator;
  }

  async _call(query: string): Promise<string> {
    const params = {
      [this.queryType]: query,
      site: this.site,
      ...this.options,
    };
    const output = await this._fetch<StackExchangeAnswer>(
      "search/excerpts",
      params
    );
    if (output.items.length < 1) {
      return `No relevant results found for '${query}' on Stack Overflow.`;
    }
    const questions = output.items
      .filter((item) => item.item_type === "question")
      .slice(0, this.maxResult);
    const answers = output.items.filter((item) => item.item_type === "answer");

    const results: string[] = [];

    for (const question of questions) {
      let res_text = `Question: ${question.title}\n${question.excerpt}`;

      const relevant_answers = answers.filter(
        (answer) => answer.question_id === question.question_id
      );
      const accepted_answers = relevant_answers.filter(
        (answer) => answer.is_accepted
      );

      if (relevant_answers.length > 0) {
        const top_answer =
          accepted_answers.length > 0
            ? accepted_answers[0]
            : relevant_answers[0];
        const { excerpt } = top_answer;
        res_text += `\nAnswer: ${excerpt}`;
      }

      results.push(res_text);
    }

    return results.join(this.resultSeparator);
  }

  /**
   * Call the StackExchange API
   * @param endpoint Name of the endpoint from StackExchange API
   * @param params Additional parameters passed to the endpoint
   * @param page Number of the page to retrieve
   * @param filter Filtering properties
   */
  private async _fetch<T>(
    endpoint: string,
    params: StackExchangeOptions = {},
    page = 1,
    filter = "default"
  ): Promise<T> {
    try {
      if (!endpoint) {
        throw new Error("No end point provided.");
      }
      const queryParams = new URLSearchParams({
        pagesize: this.pageSize.toString(),
        page: page.toString(),
        filter,
        ...params,
      });

      if (this.key) {
        queryParams.append("key", this.key);
      }
      if (this.accessToken) {
        queryParams.append("access_token", this.accessToken);
      }

      const queryParamsString = queryParams.toString();

      const endpointUrl = `${this.baseUrl}${endpoint}?${queryParamsString}`;
      return await this._makeRequest(endpointUrl);
    } catch (e) {
      throw new Error("Error while calling Stack Exchange API");
    }
  }

  /**
   * Fetch the result of a specific endpoint
   * @param endpointUrl Endpoint to call
   */
  private async _makeRequest<T>(endpointUrl: string): Promise<T> {
    try {
      const response = await fetch(endpointUrl);
      if (response.status !== 200) {
        throw new Error(`HTTP Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (e) {
      throw new Error(`Error while calling Stack Exchange API: ${endpointUrl}`);
    }
  }
}
