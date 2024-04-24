import { ToolInterface } from "@langchain/core/tools";

/**
 * Abstract base class for toolkits in LangChain. Toolkits are collections
 * of tools that agents can use. Subclasses must implement the `tools`
 * property to provide the specific tools for the toolkit.
 */
export abstract class Toolkit {
  abstract tools: ToolInterface[];

  getTools(): ToolInterface[] {
    return this.tools;
  }
}
