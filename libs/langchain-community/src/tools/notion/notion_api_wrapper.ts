import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { createChildPagePayload } from "./notion_utils.js";
import { NotionBlock } from "./types/interfaces.js";

/**
 * NotionApiWrapper class to interact with Notion API.
 * required parameters:
 * apiToken - can be set as part of the config object or through "NOTION_API_KEY" environment variable
 * baseUrl - can be set as part of the config object or through "NOTION_API_BASE_URL" environment variable
 * notionVersion - can be set as part of the config object or through "NOTION_API_VERSION" environment variable
 */
class NotionApiWrapper {
  private apiToken: string;

  private readonly baseUrl: string;

  private readonly notionVersion: string;

  /**
   * Initializes a new instance of NotionApiWrapper.
   * @param config - Optional configuration object for the API.
   */
  constructor() {
    // Set the API token, either from environment variables or the provided config
    this.apiToken = getEnvironmentVariable("NOTION_API_KEY") || "";
    if (!this.apiToken) {
      throw new Error("API token is required to initialize NotionApiWrapper.");
    }

    // Set the base URL, either from config or use default value
    this.baseUrl =
      getEnvironmentVariable("NOTION_API_BASE_URL") ||
      "https://api.notion.com/v1";

    // Set the Notion API version, either from config or use default value
    this.notionVersion =
      getEnvironmentVariable("NOTION_API_VERSION") || "2022-06-28";
  }

  /**
   * Generic method for making API requests.
   * @param method - HTTP method (GET, POST, PATCH, etc.)
   * @param endpoint - API endpoint to call.
   * @param data - Optional request payload.
   * @returns - A Promise with the response data.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: object
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Notion-Version": this.notionVersion,
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Notion API Error (Status ${response.status}): ${errorText}`
        );
        throw new Error(`Notion API Error: ${response.status} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Unexpected Error: ${error}`);
      throw error;
    }
  }

  /**
   * Fetches the content of a specific Notion page.
   * @param pageId - The ID of the page to fetch.
   * @returns - A Promise with the page content.
   */
  async getPage(pageId: string): Promise<unknown> {
    if (!pageId) {
      throw new Error("Page ID is required to fetch page content.");
    }

    return this.request("GET", `/pages/${pageId}`);
  }

  /**
   * Creates a new page in a specified Notion.
   * @param parentPageId - The ID of the parent page to create the page in.
   * @param properties - The properties and content for the new page.
   * @returns - A Promise with the created page details.
   */
  async createPage(
    parentPageId: string,
    title: string,
    content?: NotionBlock[]
  ): Promise<unknown> {
    if (!parentPageId) {
      throw new Error("Parent page ID is required to create a page.");
    }
    if (!title) {
      throw new Error("Page properties are required to create a page.");
    }

    return this.request(
      "POST",
      `/pages`,
      createChildPagePayload(parentPageId, title, content)
    );
  }

  /**
   * Archives a specific Notion page by setting the archived flag to true.
   * @param pageId - The ID of the page to archive.
   * @returns - A Promise with the archived page details.
   */
  async deletePage(pageId: string): Promise<unknown> {
    if (!pageId) {
      throw new Error("Page ID is required to delete a page.");
    }

    return this.request("PATCH", `/pages/${pageId}`, { archived: true });
  }

  /**
   * Fetches the content of a specific Notion block
   * @param blockId The ID of the notion block to fetch
   * @returns A Promise with the block content details
   */
  async getBlock(blockId: string): Promise<unknown> {
    if (!blockId) {
      throw new Error("Block ID is required to fetch block content");
    }

    return this.request("GET", `/blocks/${blockId}/children`);
  }
}

export default NotionApiWrapper;
