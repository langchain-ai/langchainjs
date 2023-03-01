/** 
 * From https://platform.openai.com/docs/api-reference/images/create
 * 
 * To use this tool, you must pass in a configured OpenAIApi object.
 */
import { OpenAIApi } from "openai";

import { Tool } from "./base.js";

export class OpenAICreateImage extends Tool {
    constructor(readonly openaiApi: OpenAIApi, readonly name: string, readonly description: string) {
        super();
    }

    async call(input: string): Promise<string> {
        const resp = await this.openaiApi.createImage({
            prompt: input,
            // TODO: Future idea -- could we ask an LLM to extract these arguments from an input that might contain them?
            n: 1,
            size: "1024x1024",
        })

        const theImageUrl = resp.data.data[0].url;

        if (!theImageUrl) {
            throw new Error(`No image URL returned from OpenAI API.`);
        }

        return theImageUrl;
    }
}