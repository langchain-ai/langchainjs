import { Tool, ToolInterface } from "@langchain/core/tools";
import { Toolkit } from "@langchain/core/indexing";
import { ConneryService } from "../../../tools/connery.js";

/**
 * ConneryToolkit provides access to all the available actions from the Connery Runner.
 * @extends Toolkit
 */
export class ConneryToolkit extends Toolkit {
  tools: ToolInterface[];

  /**
   * Creates a ConneryToolkit instance based on the provided ConneryService instance.
   * It populates the tools property of the ConneryToolkit instance with the list of
   * available tools from the Connery Runner.
   * @param conneryService The ConneryService instance.
   * @returns A Promise that resolves to a ConneryToolkit instance.
   */
  static async createInstance(
    conneryService: ConneryService
  ): Promise<ConneryToolkit> {
    const toolkit = new ConneryToolkit();
    toolkit.tools = [];

    const actions = await conneryService.listActions();
    toolkit.tools.push(...(actions as unknown as Tool[])); // This is a hack to make TypeScript happy, as TypeScript doesn't know that ConneryAction (StructuredTool) extends Tool.
    return toolkit;
  }
}
