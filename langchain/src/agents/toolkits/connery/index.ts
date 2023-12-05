import { Tool } from "@langchain/core/tools";
import { Toolkit } from "../base.js";
import { ConneryService } from "../../../tools/connery.js";

/**
 * A toolkit for working with Connery actions.
 *
 * Connery is an open-source plugin infrastructure for AI.
 * Source code: https://github.com/connery-io/connery-platform
 *
 * See an example of using this toolkit here: `./examples/src/agents/connery_mrkl.ts`
 * @extends Toolkit
 */
export class ConneryToolkit extends Toolkit {
  tools: Tool[];

  /**
   * Creates a ConneryToolkit instance based on the provided ConneryService instance.
   * It populates the tools property of the ConneryToolkit instance with the list of
   * available tools from the ConneryService instance.
   * @param conneryService The ConneryService instance.
   * @returns A Promise that resolves to a ConneryToolkit instance.
   */
  static async createInstance(
    conneryService: ConneryService
  ): Promise<ConneryToolkit> {
    const toolkit = new ConneryToolkit();
    toolkit.tools = [];

    const actions = await conneryService.listActions();
    toolkit.tools.push(...actions);

    return toolkit;
  }
}
