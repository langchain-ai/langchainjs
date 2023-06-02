import type {
  GetPageResponse,
  ListBlockChildrenResponse,
  PageObjectResponse,
  QueryDatabaseResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.js";

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
    const query: { page_size: number; start_cursor?: string } = {
      page_size: this.pageSizeLimit,
    };
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(query),
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load data from Notion. Please check your integration token and database id.`
        );
      }

      const { results, next_cursor, has_more } =
        (await response.json()) as QueryDatabaseResponse;

      pageIds.push(...results.map((page) => page.id));
      hasMore = has_more;
      query.start_cursor = next_cursor ?? undefined;
    }

    return pageIds;
  }

  private async loadPage(pageId: string): Promise<Document> {
    // Call a `Retrieve page` API
    // See https://developers.notion.com/reference/retrieve-a-page
    const response = await fetch(`${NOTION_BASE_URL}/pages/${pageId}`, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(
        `Unable to fetch page: ${response.status} ${await response.text()}`
      );
    }

    const data = (await response.json()) as GetPageResponse;

    // The official Notion SDK declares the response type of `Retrieve page` API
    // as `GetPageResponse`, which is a union of `PageObjectResponse` and
    // `PartialPageObjectResponse`. However, it is not explained in the
    // documentation when the partial response is returned.
    if (!("properties" in data)) {
      throw new Error(
        `PartialPageObjectResponse is returned: ${response.status}`
      );
    }

    const pageContent = await this.loadBlocks(data.id);
    const metadata = await this.createMetadata({ pageId, pageContent, data });
    return new Document({ pageContent, metadata });
  }

  /**
   * Create a metadata object from the response of `Retrieve page` API.
   */
  private async createMetadata({
    pageId,
    data,
  }: {
    pageId: string;
    pageContent: string;
    data: PageObjectResponse;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata: Record<string, any> = {};

    for (const [key, item] of Object.entries(data.properties)) {
      let value;

      switch (item.type) {
        case "rich_text":
          value = item.rich_text[0]?.plain_text ?? null;
          break;
        case "title":
          value = item.title[0]?.plain_text ?? null;
          break;
        case "multi_select":
          value = item.multi_select.map((el) => el.name);
          break;
        case "url":
          value = item.url;
          break;
        default:
          break;
      }

      if (value) {
        metadata[key.toLowerCase()] = value;
      }
    }

    metadata.id = pageId;
    return metadata;
  }

  private async loadBlocks(blockId: string, numberOfTabs = 0): Promise<string> {
    const resultLinesArr = [];
    let currentBlockId: string | null = blockId;

    while (currentBlockId) {
      // Call a `Retrieve block children` API
      // See https://developers.notion.com/reference/get-block-children
      const response = await fetch(
        `${NOTION_BASE_URL}/blocks/${currentBlockId}/children`,
        {
          method: "GET",
          headers: this.headers,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to fetch block: ${response.status} ${await response.text()}`
        );
      }

      const data = (await response.json()) as ListBlockChildrenResponse;

      for (const result of data.results) {
        // `result` is PartialBlockObjectResponse or BlockObjectResponse as SDK
        // declares. However, it is also not explained in the documentation when
        // the partial response is returned.
        if (!("type" in result)) {
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultObj = (result as any)[result.type];

        if (resultObj?.rich_text === undefined) {
          continue;
        }
        const richTexts = resultObj.rich_text as RichTextItemResponse[];

        const curResultTextArr = [];

        for (const richText of richTexts) {
          if ("text" in richText) {
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
