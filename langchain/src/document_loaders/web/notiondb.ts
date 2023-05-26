import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";
import { getEnvironmentVariable } from "../../util/env.js";

const NOTION_BASE_URL = "https://api.notion.com/v1";

export interface NotionDBLoaderParams {
  databaseId: string;
  notionIntegrationToken?: string;
  notionApiVersion?: string;
  pageSizeLimit?: number;
}

interface NotionPage {
  id: string;
  object: "page";
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  parent: {
    type: "database_id" | "page_id";
    database_id?: string;
    page_id?: string;
  };
  properties: {
    // @see https://developers.notion.com/reference/retrieve-a-page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [propertyName: string]: any;
  };
}

export class NotionDBLoader
  extends BaseDocumentLoader
  implements NotionDBLoaderParams
{
  public integrationToken: string;

  public databaseId: string;

  public notionApiVersion: string;

  public pageSizeLimit: number;

  private headers: Record<string, string> = {};

  constructor({
    databaseId,
    notionApiVersion = "2022-06-28",
    notionIntegrationToken = getEnvironmentVariable("NOTION_INTEGRATION_TOKEN"),
    pageSizeLimit = 50,
  }: NotionDBLoaderParams) {
    super();

    if (!notionIntegrationToken) {
      throw new Error("You must provide a Notion integration token.");
    }

    this.integrationToken = notionIntegrationToken;
    this.pageSizeLimit = pageSizeLimit;
    this.notionApiVersion = notionApiVersion;
    this.databaseId = databaseId;

    this.headers = {
      Authorization: `Bearer ${this.integrationToken}`,
      "Content-Type": "application/json",
      "Notion-Version": notionApiVersion,
    };
  }

  async load(): Promise<Document[]> {
    const pageIds = await this.retrievePageIds();
    const documents: Document[] = [];

    for (const pageId of pageIds) {
      documents.push(await this.loadPage(pageId));
    }

    return documents;
  }

  private async retrievePageIds(): Promise<string[]> {
    const url = `${NOTION_BASE_URL}/databases/${this.databaseId}/query`;

    const pageIds: string[] = [];
    const query: { page_size: number; start_cursor?: number } = {
      page_size: this.pageSizeLimit,
    };
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(query),
        headers: this.headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `Failed to load data from Notion. Please check your integration token and database id.`
        );
      }

      const { results, has_more, next_cursor } = data;

      pageIds.push(...(results?.map((page: NotionPage) => page.id) ?? []));
      hasMore = has_more;
      query.start_cursor = next_cursor;
    }

    return pageIds;
  }

  private async loadPage(pageId: string): Promise<Document> {
    const url = `${NOTION_BASE_URL}/pages/${pageId}`;
    const response = await fetch(url, { method: "GET", headers: this.headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Unable to fetch page: ${response.status} ${JSON.stringify(data)}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata: Record<string, any> = {};
    const { properties } = data;

    for (const key of Object.keys(properties)) {
      const item = properties[key];
      const itemType = item.type;
      let value;

      switch (itemType) {
        case "rich_text":
          value =
            item?.rich_text && item?.rich_text.length > 0
              ? item?.rich_text[0].plain_text
              : null;
          break;
        case "title":
          value =
            item?.title && item?.title.length > 0
              ? item?.title[0].plain_text
              : null;
          break;
        case "multi_select":
          if (item?.multi_select && item?.multi_select.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value = item?.multi_select.map((el: any) => el.name);
          }
          break;
        case "url":
          value = item?.url ? item.url : null;
          break;
        default:
          break;
      }

      if (value) {
        metadata[key.toLowerCase()] = value;
      }
    }

    metadata.id = pageId;

    return {
      pageContent: await this.loadBlocks(pageId),
      metadata,
    };
  }

  private async loadBlocks(blockId: string, numberOfTabs = 0): Promise<string> {
    const resultLinesArr = [];
    let currentBlockId = blockId;

    while (currentBlockId) {
      const response = await fetch(
        `${NOTION_BASE_URL}/blocks/${currentBlockId}/children`,
        {
          method: "GET",
          headers: this.headers,
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `Unable to fetch block: ${response.status} ${JSON.stringify(data)}`
        );
      }

      for (const result of data.results) {
        const resultObj = result[result.type];

        if (!resultObj.rich_text) {
          continue;
        }

        const curResultTextArr = [];

        for (const richText of resultObj.rich_text) {
          if (richText.text) {
            curResultTextArr.push(
              "\t".repeat(numberOfTabs) + richText.text.content
            );
          }
        }

        if (result.has_children) {
          const childrenText = await this.loadBlocks(
            result.id,
            numberOfTabs + 1
          );
          curResultTextArr.push(childrenText);
        }

        resultLinesArr.push(curResultTextArr.join("\n"));
      }

      currentBlockId = data.next_cursor;
    }

    return resultLinesArr.join("\n");
  }
}
