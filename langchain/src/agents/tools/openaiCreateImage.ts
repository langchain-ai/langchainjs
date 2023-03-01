/** 
 * From https://platform.openai.com/docs/api-reference/images/create
 * 
 * To use this tool, you must pass in a configured OpenAIApi object.
 */
import { OpenAIApi } from "openai";

import { Tool } from "./base.js";

export class OpenAICreateImage extends Tool {
    name: string = "OpenAI Create Image";
    description: string = "Create an image using the OpenAI API. Pass in a prompt, to be fed into the Dalle2 Image Generation API. Returns a URL to the image.";

    constructor(readonly openaiApi: OpenAIApi, name?: string, description?: string) {
        super();
        // name and description are both optional because they have sane defaults.
        this.name = name ? name : this.name;
        this.description = description ? description : this.description;
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