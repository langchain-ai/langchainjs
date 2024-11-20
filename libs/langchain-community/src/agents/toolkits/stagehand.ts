import {
  Tool,
  BaseToolkit as Toolkit,
  ToolInterface, 
  StructuredTool,
} from "@langchain/core/tools";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

//  Documentation is here:
//  https://js.langchain.com/docs/integrations/tools/stagehand

export class StagehandToolkit extends Toolkit {
  tools: ToolInterface[];
  stagehand?: Stagehand;

  constructor(stagehand?: Stagehand) {
    super();
    this.stagehand = stagehand;
    this.tools = this.initializeTools();
  }

  private initializeTools(): ToolInterface[] {
    return [
      new StagehandNavigateTool(this.stagehand),
      new StagehandActTool(this.stagehand),
      new StagehandExtractTool(this.stagehand),
      new StagehandObserveTool(this.stagehand),
    ];
  }

  static async fromStagehand(stagehand: Stagehand): Promise<StagehandToolkit> {
    return new StagehandToolkit(stagehand);
  }
}

abstract class StagehandToolBase extends Tool {
  protected stagehand?: Stagehand;
  private localStagehand?: Stagehand;

  constructor(stagehandInstance?: Stagehand) {
    super();
    this.stagehand = stagehandInstance;
  }

  protected async getStagehand(): Promise<Stagehand> {
    if (this.stagehand) return this.stagehand;

    if (!this.localStagehand) {
      this.localStagehand = new Stagehand({
        env: "LOCAL",
        enableCaching: true,
      });
      await this.localStagehand.init();
    }
    return this.localStagehand;
  }
}

export class StagehandNavigateTool extends StagehandToolBase {
  name = "stagehand_navigate";
  description =
    "Use this tool to navigate to a specific URL using Stagehand. The input should be a valid URL as a string.";

  async _call(input: string): Promise<string> {
    const stagehand = await this.getStagehand();
    try {
      await stagehand.page.goto(input);
      return `Successfully navigated to ${input}.`;
    } catch (error: any) {
      return `Failed to navigate to ${input}: ${error.message}`;
    }
  }
}

export class StagehandActTool extends StagehandToolBase {
  name = "stagehand_act";
  description =
    "Use this tool to perform an action on the current web page using Stagehand. The input should be a string describing the action to perform.";

  async _call(input: string): Promise<string> {
    const stagehand = await this.getStagehand();
    const result = await stagehand.act({ action: input });
    if (result.success) {
      return `Action performed successfully: ${result.message}`;
    } else {
      return `Failed to perform action: ${result.message}`;
    }
  }
}

// TODO - update Extract tool to accept a zod schema

// import { tool } from "@langchain/core/tools";
// import { z } from "zod";


// const multiply = tool(
//   ({ a, b }: { a: number; b: number }): number => {
//     /**
//      * Multiply two numbers.
//      */
//     return a * b;
//   },
//   {
//     name: "multiply",
//     description: "Multiply two numbers",
//     schema: z.object({
//       a: z.number(),
//       b: z.number(),
//     }),
//   }
// );

// TODO - finish this!!
export class StagehandExtractTool extends StructuredTool {
  name = "stagehand_extract";
  description =
    "Use this tool to extract structured information from the current web page using Stagehand.";

  // Define the input schema for the tool
  schema = z.object({
    instruction: z.string(),
  });

  private stagehand?: Stagehand;
  private extractionSchema: z.ZodTypeAny;

  constructor(stagehandInstance?: Stagehand, extractionSchema?: z.ZodTypeAny) {
    super();
    this.stagehand = stagehandInstance;
    if (!extractionSchema) {
      throw new Error("An extraction schema is required for StagehandExtractTool.");
    }
    this.extractionSchema = extractionSchema;
  }

  async _call(input: { instruction: string }): Promise<string> {
    const stagehand = await this.getStagehand();
    const { instruction } = input;

    try {
      const result = await stagehand.extract({
        instruction,
        schema: this.extractionSchema,
      });
      return JSON.stringify(result);
    } catch (error: any) {
      return `Failed to extract information: ${error.message}`;
    }
  }

  protected async getStagehand(): Promise<Stagehand> {
    if (this.stagehand) return this.stagehand;

    if (!this.localStagehand) {
      this.localStagehand = new Stagehand({
        env: "LOCAL",
        enableCaching: true,
      });
      await this.localStagehand.init();
    }
    return this.localStagehand;
  }

  private localStagehand?: Stagehand;
}

export class StagehandObserveTool extends StagehandToolBase {
  name = "stagehand_observe";
  description =
    "Use this tool to observe the current web page and retrieve possible actions using Stagehand. The input can be an optional instruction string.";

  async _call(input: string): Promise<string> {
    const stagehand = await this.getStagehand();
    const instruction = input || undefined;

    try {
      const result = await stagehand.observe({ instruction });
      return JSON.stringify(result);
    } catch (error: any) {
      return `Failed to observe page: ${error.message}`;
    }
  }
}
