import { BaseToolkit, StructuredToolInterface } from "@langchain/core/tools";
import {
  CreateNotionPageTool,
  GetNotionPageTool,
  GetBlockContentTool,
  DeleteNotionPageTool,
} from "../../../tools/notion/tools.js";

/**
 * A toolkit that aggregates various Notion tools into a single collection.
 * The NotionToolkit utilizes the NotionApiWrapper for API interactions.
 */
export class NotionToolkit extends BaseToolkit {
  tools: StructuredToolInterface[];

  /**
   * Initializes the NotionToolkit instance.
   */
  constructor() {
    super();
    this.tools = [
      new GetNotionPageTool(),
      new CreateNotionPageTool(),
      new DeleteNotionPageTool(),
      new GetBlockContentTool(),
    ];
  }

  /**
   * Retrieves the list of tools available in the toolkit.
   * @returns An array of StructuredToolInterface instances representing the tools.
   */
  getTools(): StructuredToolInterface[] {
    return this.tools;
  }
}
