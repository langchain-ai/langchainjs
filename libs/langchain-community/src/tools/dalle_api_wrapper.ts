import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { OpenAI as OpenAIClient } from "openai";
import { Tool, ToolParams } from "@langchain/core/tools";

/*
 *  An enumerator for the Dall-E model to use with the OpenAI.
 *  Dall-E 2 and 3 API
 *  @link {https://beta.openai.com/docs/api-reference/images/generate}
 */
export enum DalleApiWrapperModelEnum {
    DALLE_2 = "dall-e-2",
    DALLE_3 = "dall-e-3"
}

/*
 *  An enumerator for the style of the generated images.
 *  natural: causes the model to produce more natural, less hyper-real looking images.
 *  vivid: causes the model to lean towards generating hyper-real and dramatic images.
 */
export enum DalleStyle {
    NATURAL = "natural",
    VIVID = "vivid"
}

/*
 *  An enumerator for the quality of the image that will be generated.
 *  standard: creates images with finer details and greater consistency across the image.
 *  hd: creates images with finer details and greater consistency across the image.
 */
export enum QualityEnum { 
    STANDARD = "standard",
    HD = "hd"
}

/*
 *  An enumerator for the format in which the generated images are returned.
 *  url: The format in which the generated images are returned.
 *  b64_json: The format in which the generated images are returned.
 */
export enum ResponseFormatEnum {
    URL = "url",
    B64_JSON = "b64_json"
}

/*
 *  An enumerator for the size of the generated images.
 *  256x256: The size of the generated images.
 *  512x512: The size of the generated images.
 *  1024x1024: The size of the generated images.
 *  1792x1024: The size of the generated images.
 *  1024x1792: The size of the generated images.
 */
export enum SizeEnum {
    _256x256 = "256x256",
    _512x512 = "512x512",
    _1024x1024 = "1024x1024",
    _1792x1024 = "1792x1024",
    _1024x1792 = "1024x1792"
}

/*
 *  An interface for the Dall-E API Wrapper.
 *
 *  New parameters:
 *  model (‘dall-e-2’ or ‘dall-e-3’): This is the model you’re generating with. Be careful to set it to ‘dall-e-3’ as it defaults to ‘dall-e-2’ if empty.
 *  style (‘natural’ or ‘vivid’): The style of the generated images. Must be one of vivid or natural. Vivid causes the model to lean towards generating hyper-real and dramatic images. Natural causes the model to produce more natural, less hyper-real looking images. Defaults to ‘vivid’.
 *  quality (‘standard’ or ‘hd’): The quality of the image that will be generated. ‘hd’ creates images with finer details and greater consistency across the image. Defaults to ‘standard’.
 *
 *  Other parameters:
 *  prompt (string): A text description of the desired image(s). The maximum length is 1000 characters. Required field.
 *  n (number): The number of images to generate. Must be between 1 and 10. Defaults to 1. For dall-e-3, only n=1 is supported.
 *  size (...): The size of the generated images. Must be one of 256x256, 512x512, or 1024x1024 for DALL·E-2 models. Must be one of 1024x1024, 1792x1024, or 1024x1792 for DALL·E-3 models.
 *  response_format ('url' or 'b64_json'): The format in which the generated images are returned. Must be one of "url" or "b64_json". Defaults to "url".
 *  user (string): A unique identifier representing your end-user, which will help OpenAI to monitor and detect abuse. Learn more.
 */
export interface DalleApiWrapperParams extends ToolParams {
    /**
     * The OpenAI API key
     */
    openAIApiKey?: string;

    /**
     * The model to use
     * @default "dalle-3"
     */
    modelName?: string;

    /**
     * The style of the generated images.
     * @default "vivid"
     */
    style?: DalleStyle;

    /**
     * The quality of the image that will be generated.
     * @default "standard"
     */
    quality?: QualityEnum;

    /**
     * A text description of the desired image(s). This value will be overridden by the input value.
     */
    prompt: string;

    /**
     * The number of images to generate. Must be between 1 and 10. Defaults to 1. For dall-e-3, only n=1 is supported.
     * @default 1
     */
    n?: number;

    /**
     * The size of the generated images.
     * @default "1024x1024"
     */
    size?: SizeEnum;

    /**
     * The response format in which the generated images are returned.
     * @default "url"
     */
    responseFormat?: ResponseFormatEnum;

    /**
     * A unique identifier representing your end-user, which will help OpenAI to monitor and detect abuse.
     */
    user?: string;

    /**
     * The organization to use
     */
    organization?: string;
}

/**
 * A tool for generating images with Open AIs Dall-E 2 or 3 API.
 */
export class DalleApiWrapper extends Tool {
    static lc_name() {
        return "DalleApiWrapper";
    }

    name = "dalle_api_wrapper";

    description = `A OpenAI Dall-E tool. useful for generating images with Open AIs Dall-E 2 or 3 API.`;

    organization?: string;

    protected client: OpenAIClient;

    static readonly toolName = 'dalle_api_wrapper';

    private model: string = DalleApiWrapperModelEnum.DALLE_3;
    private style: DalleStyle = DalleStyle.VIVID;
    private quality: QualityEnum = QualityEnum.STANDARD;
    private n: number = 1;
    private size: SizeEnum = SizeEnum._1024x1024;
    private responseFormat: ResponseFormatEnum = ResponseFormatEnum.URL;
    private user: string | undefined;

    constructor(fields?: DalleApiWrapperParams) {
        super(fields);
        const openAIApiKey = fields?.openAIApiKey ?? getEnvironmentVariable("OPENAI_API_KEY");
        
        this.organization =
            fields?.organization ??
            getEnvironmentVariable("OPENAI_ORGANIZATION");

        const clientConfig = {
            apiKey: openAIApiKey,
            organization: this.organization,
            dangerouslyAllowBrowser: true,
        };
        this.client = new OpenAIClient(clientConfig);
        this.model = fields?.modelName ?? DalleApiWrapperModelEnum.DALLE_3;
        this.style = fields?.style ?? DalleStyle.VIVID;
        this.quality = fields?.quality ?? QualityEnum.STANDARD;
        this.n = fields?.n ?? 1;
        this.size = fields?.size ?? SizeEnum._1024x1024;
        this.responseFormat = fields?.responseFormat ?? ResponseFormatEnum.URL;
        this.user = fields?.user;
    }

    /** @ignore */
    async _call(input: string): Promise<string> {
        const response = await this.client.images.generate({
            model: this.model?.valueOf() ?? DalleApiWrapperModelEnum.DALLE_3,
            prompt: input,
            n: this.n ?? 1,
            size: this.size ?? SizeEnum._1024x1024,
            response_format: this.responseFormat ?? ResponseFormatEnum.URL,
            style: this.style ?? DalleStyle.VIVID,
            quality: this.quality ?? QualityEnum.STANDARD,
            user: this.user,
        });
    
        const urls = response.data.map(item => item.url) as string[];
        
        return urls[0];
    }
}