import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import NotionApiWrapper from "./notion_api_wrapper.js";
import { notionBlockSchema } from "./types/zod_schemas.js";
import { NotionBlock } from "./types/interfaces.js";

/**
 * Tool for creating a new page in a Notion.
 */
export class CreateNotionPageTool extends StructuredTool {
  name = "createNotionPage";

  description =
    "Creates a new Notion page in the specified database with the given content.";

  schema = z.object({
    parentPageId: z.string(),
    title: z.string(),
    content: z.array(notionBlockSchema).optional(),
  });

  private notionApi: NotionApiWrapper;

  /**
   * Constructor to initialize the CreateNotionPageTool with the Notion API wrapper.
   */
  constructor() {
    super();
    this.notionApi = new NotionApiWrapper();
  }

  /**
   * Executes the tool to create a Notion page in the specified database.
   * @param param0 - An object containing the parent page ID and title for the new page.
   * @returns The details of the newly created page.
   */
  async _call({
    parentPageId,
    title,
    content,
  }: {
    parentPageId: string;
    title: string;
    content?: NotionBlock[];
  }) {
    return this.notionApi.createPage(parentPageId, title, content);
  }
}

/**
 * Tool for reading a Notion page.
 */
export class GetNotionPageTool extends StructuredTool {
  name = "getNotionPage";

  description = "Gets the metadata of a Notion page by its ID.";

  schema = z.object({
    pageId: z.string(),
  });

  private notionApi: NotionApiWrapper;

  /**
   * Constructor to initialize the ReadNotionPageTool with the Notion API wrapper.
   */
  constructor() {
    super();
    this.notionApi = new NotionApiWrapper();
  }

  /**
   * Executes the tool to read a Notion page based on the provided page ID.
   * @param param0 - An object containing the page ID.
   * @returns The content of the specified Notion page.
   */
  async _call({ pageId }: { pageId: string }) {
    return this.notionApi.getPage(pageId);
  }
}

/**
 * Tool for archiving a Notion page.
 */
export class DeleteNotionPageTool extends StructuredTool {
  name = "deleteNotionPage";

  description =
    "Deletes a Notion page by setting its archived flag to true. Expects an ID.";

  schema = z.object({
    pageId: z.string(),
  });

  private notionApi: NotionApiWrapper;

  /**
   * Constructor to initialize the ArchiveNotionPageTool with the Notion API wrapper.
   */
  constructor() {
    super();
    this.notionApi = new NotionApiWrapper();
  }

  /**
   * Executes the tool to archive a Notion page based on the provided page ID.
   * @param param0 - An object containing the page ID.
   * @returns The details of the archived page.
   */
  async _call({ pageId }: { pageId: string }) {
    return this.notionApi.deletePage(pageId);
  }
}

/**
 * Tool for retrieving content of the notion block (page, paragraph, etc.)
 */
export class GetBlockContentTool extends StructuredTool {
  name = "getBlockContent";

  description = "Retrieves content of the block or page by block ID";

  schema = z.object({
    blockId: z.string(),
  });

  private notionApi: NotionApiWrapper;

  /**
   * Constructor to initialize the GetBlockContentTool with the Notion API wrapper.
   */
  constructor() {
    super();
    this.notionApi = new NotionApiWrapper();
  }

  /**
   * Executes the tool to fetch content of a Notion block based on the provided ID
   * @param param0 - An object containing the block ID.
   * @returns The content of the specified block ID
   */
  async _call({ blockId }: { blockId: string }) {
    return this.notionApi.getBlock(blockId);
  }
}
