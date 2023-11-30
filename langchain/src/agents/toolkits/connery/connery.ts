import { StructuredTool, Tool } from "@langchain/core/tools";
import { Toolkit } from "../base.js";
import { ConneryService } from "../../../tools/connery.js";

export class ConneryToolkit extends Toolkit {
  tools: StructuredTool[];

  static async fromConnerySerice(
    conneryService: ConneryService
  ): Promise<ConneryToolkit> {
    const toolkit = new ConneryToolkit();
    const actions = await conneryService.listActions();
    toolkit.tools.push(...actions);

    return toolkit;
  }
}
