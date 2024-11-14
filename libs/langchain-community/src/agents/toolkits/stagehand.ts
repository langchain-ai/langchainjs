import {
  Tool,
  BaseToolkit as Toolkit,
  ToolInterface,
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
export class StagehandExtractTool extends StagehandToolBase {
  name = "stagehand_extract";
  description =
    "Use this tool to extract structured information from the current web page using Stagehand. The input should be an object with 'instruction' and 'schema' fields.";

  async _call(input: string): Promise<string> {
    const stagehand = await this.getStagehand();
    let parsedInput;
    if (typeof input === "string") {
      try {
        parsedInput = JSON.parse(input);
      } catch (error) {
        return `Invalid input. Please provide a JSON string with 'instruction' and 'schema' fields.`;
      }
    } else {
      parsedInput = input;
    }

    const { instruction, schema } = parsedInput;

    if (!instruction || !schema) {
      return `Input must contain 'instruction' and 'schema' fields.`;
    }

    // Reconstruct the Zod schema
    let zodSchema;
    try {
      zodSchema = this.convertToZodSchema(schema);
    } catch (error: any) {
      return `Failed to reconstruct schema: ${error.message}`;
    }

    try {
      const result = await stagehand.extract({
        instruction,
        schema: zodSchema as z.ZodObject<any>,
      });
      return JSON.stringify(result);
    } catch (error: any) {
      return `Failed to extract information: ${error.message}`;
    }
  }

  private convertToZodSchema(schema: any): z.ZodType<any> {
    if (Array.isArray(schema.type)) {
      // Handle cases like type: ["string", "null"]
      if (schema.type.includes("null")) {
        const typesWithoutNull = schema.type.filter(
          (t: string) => t !== "null"
        );
        if (typesWithoutNull.length === 1) {
          return this.convertToZodSchema({
            ...schema,
            type: typesWithoutNull[0],
          }).nullable();
        } else {
          const zodTypes = typesWithoutNull.map((t: string) =>
            this.convertToZodSchema({ ...schema, type: t })
          );
          return z.union(zodTypes).nullable();
        }
      } else {
        // Handle union types
        const zodTypes = schema.type.map((t: string) =>
          this.convertToZodSchema({ ...schema, type: t })
        );
        return z.union(zodTypes);
      }
    }

    switch (schema.type) {
      case "string":
        return z.string();
      case "number":
        return z.number();
      case "boolean":
        return z.boolean();
      case "object": {
        const properties = schema.properties || {};
        const required = schema.required || [];
        const zodObjShape = Object.fromEntries(
          Object.entries(properties).map(([key, propertySchema]) => {
            const isRequired = required.includes(key);
            const zodPropType = this.convertToZodSchema(propertySchema);
            return [key, isRequired ? zodPropType : zodPropType.optional()];
          })
        );
        return z.object(zodObjShape);
      }
      case "array": {
        const itemsSchema = schema.items;
        if (!itemsSchema) {
          throw new Error(`'items' property is missing for array type.`);
        }
        const zodItemType = this.convertToZodSchema(itemsSchema);
        return z.array(zodItemType);
      }
      default:
        throw new Error(`Unsupported schema type: ${schema.type}`);
    }
  }
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
