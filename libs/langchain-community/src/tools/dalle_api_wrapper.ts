// import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { RunnableConfig } from "@langchain/core/runnables";
import { Tool } from "@langchain/core/tools";

export class DalleApiWrapper extends Tool {
    protected _call(arg: any, runManager?: CallbackManagerForToolRun | undefined, config?: RunnableConfig | undefined): Promise<string> {
        throw new Error("Method not implemented.");
    }
    name: string;
    description: string;
    static readonly toolName = 'dalle_api_wrapper';
}