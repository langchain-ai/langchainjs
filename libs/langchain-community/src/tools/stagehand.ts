import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { Tool, type ToolParams, ToolInterface } from "@langchain/core/tools";

import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Stagehand } from "@browserbasehq/stagehand";
import { Toolkit } from "../base.js";
import { z } from "zod";

// TODO - add documentation link - SEE XX DOCUMENTATION

export class StagehandToolkit extends Toolkit {
  tools: ToolInterface[];

  /**
   * Creates a StagehandToolkit instance with all Stagehand tools initialized with a shared Stagehand instance.
   * It populates the tools property of the StagehandToolkit instance.
   * @returns A Promise that resolves to a StagehandToolkit instance.
   */
  static async createInstance(): Promise<StagehandToolkit> {
    const toolkit = new StagehandToolkit();
    toolkit.tools = [];

    // Initialize single Stagehand instance to be shared across tools
    const stagehand = new Stagehand({
      env: "LOCAL", 
      enableCaching: true,
    });

    // Create tools with shared Stagehand instance
    const actTool = new StagehandActTool(stagehand);
    const extractTool = new StagehandExtractTool(stagehand);
    const observeTool = new StagehandObserveTool(stagehand);

    toolkit.tools.push(actTool, extractTool, observeTool);
    
    return toolkit;
  }
}


// ACT TOOL
export class StagehandActTool extends Tool {
  name = "stagehand_act";

  description =
    "Use this tool to perform an action on the current web page using Stagehand. The input should be a string describing the action to perform.";

  private stagehand: Stagehand;

  constructor(stagehandInstance?: Stagehand) {
    super();
    if (stagehandInstance) {
      this.stagehand = stagehandInstance;
    } else {
      this.stagehand = new Stagehand({
        env: "LOCAL",
        enableCaching: true,
      });
    }
  }

  async _call(input: string): Promise<string> {
    await this.stagehand.init();
    const result = await this.stagehand.act({ action: input });
    if (result.success) {
      return `Action performed successfully: ${result.message}`;
    } else {
      return `Failed to perform action: ${result.message}`;
    }
  }
}

// extract tool

export class StagehandExtractTool extends Tool {
  name = "stagehand_extract";

  description =
    "Use this tool to extract structured information from the current web page using Stagehand. The input should be a JSON string with 'instruction' and 'schema' fields.";

  private stagehand: Stagehand;

  constructor(stagehandInstance?: Stagehand) {
    super();
    if (stagehandInstance) {
      this.stagehand = stagehandInstance;
    } else {
      this.stagehand = new Stagehand({
        env: "LOCAL",
        enableCaching: true,
      });
    }
  }

  async _call(input: string): Promise<string> {
    await this.stagehand.init();

    let parsedInput;
    try {
      parsedInput = JSON.parse(input);
    } catch (error) {
      return `Invalid input. Please provide a JSON string with 'instruction' and 'schema' fields.`;
    }

    const { instruction, schema } = parsedInput;

    if (!instruction || !schema) {
      return `Input must contain 'instruction' and 'schema' fields.`;
    }

    let zodSchema;
    try {
      zodSchema = eval(schema); // Be cautious with eval
    } catch (error) {
      return `Invalid schema.`;
    }

    try {
      const result = await this.stagehand.extract({
        instruction,
        schema: zodSchema,
      });
      return JSON.stringify(result);
    } catch (error) {
      return `Failed to extract information: ${error.message}`;
    }
  }
}
//Note: Be cautious when using eval as it can execute arbitrary code. It's important to ensure that the input schema is safe and sanitized. Alternatively, predefine schemas or limit the inputs.

// OBSERVE TOOL
export class StagehandObserveTool extends Tool {
  name = "stagehand_observe";

  description =
    "Use this tool to observe the current web page and retrieve possible actions using Stagehand. The input can be an optional instruction string.";

  private stagehand: Stagehand;

  constructor(stagehandInstance?: Stagehand) {
    super();
    if (stagehandInstance) {
      this.stagehand = stagehandInstance;
    } else {
      this.stagehand = new Stagehand({
        env: "LOCAL",
        enableCaching: true,
      });
    }
  }

  async _call(input: string): Promise<string> {
    await this.stagehand.init();

    const instruction = input || undefined;

    try {
      const result = await this.stagehand.observe({ instruction });
      return JSON.stringify(result);
    } catch (error) {
      return `Failed to observe page: ${error.message}`;
    }
  }
}