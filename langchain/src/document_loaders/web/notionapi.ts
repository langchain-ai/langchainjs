import { Client, isFullPage, iteratePaginatedAPI } from "@notionhq/client";
import {
  GetPageResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import { NotionToMarkdown } from "notion-to-md";
import { getBlockChildren } from "notion-to-md/build/utils/notion.js";

import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";

export type NotionAPIType = "database" | "page";

export type NotionAPILoaderOptions = {
  clientOptions: ConstructorParameters<typeof Client>[0];
  id: string;
  type: NotionAPIType;
};

export class NotionAPILoader extends BaseDocumentLoader {
  private notionClient: Client;

  private n2mClient: NotionToMarkdown;

  private id: string;

  private type: NotionAPIType;

  constructor(options: NotionAPILoaderOptions) {
    super();

    this.notionClient = new Client(options.clientOptions);
    this.n2mClient = new NotionToMarkdown({
      notionClient: this.notionClient,
      config: { parseChildPages: false, convertImagesToBase64: false },
    });
    this.id = options.id;
    this.type = options.type;
  }

  private parsePageProperties(page: PageObjectResponse): {
    [key: string]: string;
  } {
    return Object.fromEntries(
      Object.entries(page.properties).map(([_, prop]) => {
        switch (prop.type) {
          case "number":
            return [prop.type, prop[prop.type]];
          case "url":
            return [prop.type, prop[prop.type]];
          case "select":
            return [prop.type, prop[prop.type]?.name ?? ""];
          case "multi_select":
            return [
              prop.type,
              prop[prop.type].map((select) => select.name).join(", "),
            ];
          case "status":
            return [prop.type, prop[prop.type]?.name ?? ""];
          case "date":
            return [
              prop.type,
              `${prop[prop.type]?.start ?? ""}${
                prop[prop.type]?.end ? `-  ${prop[prop.type]?.end}` : ""
              }`,
            ];
          case "email":
            return [prop.type, prop[prop.type]];
          case "phone_number":
            return [prop.type, prop[prop.type]];
          case "checkbox":
            return [prop.type, prop[prop.type].toString()];
          // case "files":
          case "created_by":
            return [prop.type, prop[prop.type]];
          case "created_time":
            return [prop.type, prop[prop.type]];
          case "last_edited_by":
            return [prop.type, prop[prop.type]];
          case "last_edited_time":
            return [prop.type, prop[prop.type]];
          // case "formula":
          case "title":
            return [
              prop.type,
              prop[prop.type].map((v) => v.plain_text).join(""),
            ];
          case "rich_text":
            return [
              prop.type,
              prop[prop.type].map((v) => v.plain_text).join(""),
            ];
          case "people":
            return [prop.type, prop[prop.type]];
          // case "relation":
          // case "rollup":

          default:
            return [prop.type, "Unsupported type"];
        }
      })
    );
  }

  private parsePageDetails(page: GetPageResponse) {
    if (!isFullPage(page)) return;
    const metadata = Object.fromEntries(
      Object.entries(page).filter(([key, _]) => key !== "id")
    );
    return {
      ...metadata,
      notionId: page.id,
      properties: this.parsePageProperties(page),
    };
  }

  private async loadPage(
    page: string | PageObjectResponse
  ): Promise<Document[]> {
    // Check page is a page ID or a GetPageResponse
    const [pageData, pageId] =
      typeof page === "string"
        ? [this.notionClient.pages.retrieve({ page_id: page }), page]
        : [page, page.id];

    const [pageDetails, pageBlocks] = await Promise.all([
      pageData,
      getBlockChildren(this.notionClient, pageId, null),
    ]);

    const [childPageDocuments, childDatabaseDocuments, mdBlocks] =
      await Promise.all([
        Promise.all(
          pageBlocks
            .filter(
              (block) => "type" in block && block.type.includes("child_page")
            )
            .map((block) => this.loadPage(block.id))
        ),
        Promise.all(
          pageBlocks
            .filter(
              (block) =>
                "type" in block && block.type.includes("child_database")
            )
            .map((block) => this.loadDatabase(block.id))
        ),
        this.n2mClient.blocksToMarkdown(pageBlocks),
      ]);

    const mdStringObject = this.n2mClient.toMarkdownString(mdBlocks);

    const pageDocuments = Object.entries(mdStringObject).map(
      ([_, pageContent]) =>
        new Document({
          pageContent,
          metadata: this.parsePageDetails(pageDetails),
        })
    );

    return [
      ...pageDocuments,
      ...childPageDocuments.flat(),
      ...childDatabaseDocuments.flat(),
    ];
  }

  private async loadDatabase(id: string): Promise<Document[]> {
    const documents: Document[] = [];

    try {
      for await (const page of iteratePaginatedAPI(
        this.notionClient.databases.query,
        {
          database_id: id,
        }
      )) {
        if (!isFullPage(page)) continue;

        documents.push(...(await this.loadPage(page)));
      }
    } catch (e) {
      console.log(e);
      // TODO: Catch and report api request errors
    }

    return documents;
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];

    switch (this.type) {
      case "page":
        documents.push(...(await this.loadPage(this.id)));
        break;
      case "database":
        documents.push(...(await this.loadDatabase(this.id)));
        break;
      default:
    }

    return documents;
  }
}
