import * as querystring from 'querystring';
import { Tool } from "@langchain/core/tools";

interface Question {
    item_type: string;
    title: string;
    excerpt: string;
    question_id: number;
}

interface Answer {
    item_type: string;
    question_id: number;
    is_accepted: boolean;
    excerpt: string;
}
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
    queryType?: 'all' | 'title' | 'body';
    /**
     * Additional params to pass to the StackExchange API
     */
    options?: Record<string, unknown>
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
    name: 'stackexchange';

    description: "Stack Exchange API Implementation";

    private pageSize: number;

    private maxResult = 3;

    private key: string | null;

    private accessToken: string | null;

    private site = "stackoverflow";

    private version = "2.3";

    private baseUrl = "https://api.stackexchange.com";

    private queryType = 'all'

    private options?: Record<string, unknown> = {}

    private resultSeparator?: string = "\n\n";

    constructor(params: StackExchangeAPIParams = {}) {
        const { maxResult, queryType = 'all', options, resultSeparator } = params;
        super();
        this.maxResult = maxResult || this.maxResult;
        this.pageSize = 100;
        this.baseUrl = `${this.baseUrl}/${this.version}/`;
        this.queryType = queryType === 'all' ? 'q' : queryType;
        this.options = options || this.options;
        this.resultSeparator = resultSeparator || this.resultSeparator;
    }

    async _call(query: string): Promise<string> {
        const params = {
            [this.queryType]: query,
            site: this.site,
            ...this.options
        }
        const output = await this._fetch("search/excerpts", params);
        if (output.items.length < 1) {
            return `No relevant results found for '${query}' on Stack Overflow.`
        }
        const questions: Question[] = output.items.filter((item: Question) => item.item_type === "question").slice(0, this.maxResult);
        const answers: Answer[] = output.items.filter((item: Answer) => item.item_type === "answer");

        const results: string[] = [];

        for (const question of questions) {
            let res_text = `Question: ${question.title}\n${question.excerpt}`;

            const relevant_answers: Answer[] = answers.filter((answer: Answer) => answer.question_id === question.question_id);
            const accepted_answers: Answer[] = relevant_answers.filter((answer: Answer) => answer.is_accepted);

            if (relevant_answers.length > 0) {
                const top_answer = accepted_answers.length > 0 ? accepted_answers[0] : relevant_answers[0];
                const { excerpt } = top_answer;
                res_text += `\nAnswer: ${excerpt}`;
            }

            results.push(res_text);
        }

        return results.join(this.resultSeparator);
    }


    private async _fetch(endpoint: string, params: Record<string, unknown> = {}, page = 1, filter = "default"): Promise<any> {
        try {
            if (!endpoint) {
                return new Error("No end point provided.");
            }
            const queryParams: Record<string, any> = {
                pagesize: this.pageSize,
                page,
                filter,
                ...params
            };

            if (this.key) {
                queryParams.key = this.key;
            }
            if (this.accessToken) {
                queryParams.access_token = this.accessToken;
            }

            const queryParamsString = querystring.stringify(queryParams);

            const endpointUrl = `${this.baseUrl}${endpoint}?${queryParamsString}`;
            return await this.makeRequest(endpointUrl);
        } catch (e) {
            return new Error("Error while calling Stack Exchange API")
        }
    }

    private async makeRequest(endpointUrl: string): Promise<any> {
        try {
            const response = await fetch(endpointUrl);
            if (response.status !== 200) {
                throw new Error(`HTTP Error: ${response.statusText}`);
            }
            return await response.json();
        } catch (e) {
            return new Error(`Error while calling Stack Exchange API: ${endpointUrl}`)
        }
    }
}
