import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";
import { Buffer } from 'buffer';

export class DataForSeoAPISearch extends Tool {
    protected apiLogin: string;
    protected apiPassword: string;
    protected defaultParams: Record<string, any> = {
        "location_name": "United States",
        "language_code": "en",
        "se_depth": 10,
        "se_name": "google",
        "se_type": "organic"
    };
    protected params: Record<string, any> = {};
    protected json_result_types: Array<string> | null = null;
    protected json_result_fields: Array<string> | null = null;
    protected top_count: number | null = null;
    
    constructor(apiLogin: string, apiPassword: string, params: Record<string, any> = {}) {
        super();
        this.apiLogin = apiLogin ?? getEnvironmentVariable("DATAFORSEO_LOGIN");
        this.apiPassword = apiPassword ?? getEnvironmentVariable("DATAFORSEO_PASSWORD");
        this.params = { ...this.defaultParams, ...params };
        if (!this.apiLogin || !this.apiPassword) {
            throw new Error("DataForSEO login or password not set. You can set it as DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in your .env file, or pass it to DataForSeoAPIWrapper.");
        }
    }

    name = "dataforseo-api-wrapper";
    description = "A robust Google Search API provided by DataForSeo. This tool is handy when you need information about trending topics or current events.";

    async _call(keyword: string): Promise<string>  {
        return this.processResponse(await this.getResponseJson(keyword));
    }

    async results(keyword: string): Promise<Array<any>> {
        const res = await this.getResponseJson(keyword);
        return this.filterResults(res, this.json_result_types);
    }
    
    private prepareRequest(keyword: string): { url: string, headers: any, data: any } {
        if (this.apiLogin === undefined || this.apiPassword === undefined) {
            throw new Error("api_login or api_password is not provided");
        }

        const credentials = Buffer.from(this.apiLogin + ":" + this.apiPassword, 'utf-8').toString('base64');
        const headers = { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json" };
        const obj: any = { "keyword": encodeURIComponent(keyword) };
        const mergedParams = { ...obj, ...this.params };
        const data = [mergedParams];

        return {
            "url": `https://api.dataforseo.com/v3/serp/${mergedParams['se_name']}/${mergedParams['se_type']}/live/advanced`,
            "headers": headers,
            "data": data
        };
    }

    private async getResponseJson(url: string): Promise<any> {
        const requestDetails = this.prepareRequest(url);
        const response = await fetch(requestDetails.url, {
            method: 'POST',
            headers: requestDetails.headers,
            body: JSON.stringify(requestDetails.data)
        });

        if (!response.ok) {
            throw new Error(`Got ${response.status} error from DataForSEO: ${response.statusText}`);
        }

        const result = await response.json();
        return this.checkResponse(result);
    }

    private checkResponse(response: any): any {
        if (response.status_code !== 20000) {
            throw new Error(`Got error from DataForSEO SERP API: ${response.status_message}`);
        }
        return response;
    }

    private filterResults(res: any, types: Array<string> | null): Array<any> {
        const output: Array<any> = [];
        for (let task of res.tasks || []) {
            for (let result of task.result || []) {
                for (let item of result.items || []) {
                    if (types === null || types.length === 0 || types.includes(item.type)) {
                        this.cleanupUnnecessaryItems(item);
                        if (Object.keys(item).length !== 0) {
                            output.push(item);
                        }
                    }
                    if (this.top_count !== null && output.length >= this.top_count) {
                        break;
                    }
                }
            }
        }
        return output;
    }

    private cleanupUnnecessaryItems(d: any): any {
        if (this.json_result_fields !== null) {
            for (let key in d) {
                if (typeof d[key] === 'object' && d[key] !== null) {
                    this.cleanupUnnecessaryItems(d[key]);
                    if (Object.keys(d[key]).length === 0) {
                        delete d[key];
                    }
                } else if (!this.json_result_fields.includes(key)) {
                    delete d[key];
                }
            }
        }

        ["xpath", "position", "rectangle"].forEach(key => delete d[key]);
        for (let key in d) {
            if (typeof d[key] === 'object' && d[key] !== null) {
                this.cleanupUnnecessaryItems(d[key]);
            }
        }

        return d;
    }

    private processResponse(res: any): string {
        let toret = "No good search result found";
        for (let task of res.tasks || []) {
            for (let result of task.result || []) {
                let item_types = result.item_types;
                let items = result.items || [];
                if (item_types.includes('answer_box')) {
                    toret = items.find((item: { type: string, text: string }) => item.type === "answer_box").text;
                } else if (item_types.includes('knowledge_graph')) {
                    toret = items.find((item: { type: string, description: string }) => item.type === "knowledge_graph").description;
                } else if (item_types.includes('featured_snippet')) {
                    toret = items.find((item: { type: string, description: string }) => item.type === "featured_snippet").description;
                } else if (item_types.includes('shopping')) {
                    toret = items.find((item: { type: string, price: string }) => item.type === "price").price;
                } else if (item_types.includes('organic')) {
                    toret = items.find((item: { type: string, description: string }) => item.type === "organic").description;
                }
                if (toret) {
                    break;
                }
            }
        }
        return toret;
    }
}
