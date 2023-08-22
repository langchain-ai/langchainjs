import {
  Client,
  isFullBlock,
  isFullPage,
  iteratePaginatedAPI,
} from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { getBlockChildren } from "notion-to-md/build/utils/notion.js";
import type {
  ListBlockChildrenResponseResults,
  MdBlock,
} from "notion-to-md/build/types";

import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GuardType<T> = T extends (x: any, ...rest: any) => x is infer U
  ? U
  : never;

type BlockObjectResponse = GuardType<typeof isFullBlock>;
type PageObjectResponse = GuardType<typeof isFullPage>;

/**
 * Represents the type of Notion API to load documents from. The options
 * are "database" or "page".
 */
export type NotionAPIType = "database" | "page";

export type NotionAPILoaderOptions = {
  clientOptions: ConstructorParameters<typeof Client>[0];
  id: string;
  type: NotionAPIType;
};

/**
 * A class that extends the BaseDocumentLoader class. It represents a
 * document loader for loading documents from Notion using the Notion API.
 */
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

  /**
   * Parses the properties of a Notion page and returns them as key-value
   * pairs.
   * @param page The Notion page to parse.
   * @returns An object containing the parsed properties as key-value pairs.
   */
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

  /**
   * Parses the details of a Notion page and returns them as an object.
   * @param page The Notion page to parse.
   * @returns An object containing the parsed details of the page.
   */
  private parsePageDetails(page: PageObjectResponse) {
    const metadata = Object.fromEntries(
      Object.entries(page).filter(([key, _]) => key !== "id")
    );
    return {
      ...metadata,
      notionId: page.id,
      properties: this.parsePageProperties(page),
    };
  }

  /**
   * Loads a Notion block and returns it as an MdBlock object.
   * @param block The Notion block to load.
   * @returns A Promise that resolves to an MdBlock object.
   */
  private async loadBlock(block: BlockObjectResponse): Promise<MdBlock> {
    return {
      type: block.type,
      blockId: block.id,
      parent: await this.n2mClient.blockToMarkdown(block),
      children: [],
    };
  }

  /**
   * Loads Notion blocks and their child documents recursively.
   * @param blocksResponse The response from the Notion API containing the blocks to load.
   * @returns A Promise that resolves to an object containing the loaded MdBlocks and child Documents.
   */
  private async loadBlocksAndDocs(
    blocksResponse: ListBlockChildrenResponseResults
  ): Promise<{ mdBlocks: MdBlock[]; childDocuments: Document[] }> {
    const blocks = blocksResponse.filter(isFullBlock);

    const [childPageDocuments, childDatabaseDocuments, blocksDocsArray] =
      await Promise.all([
        Promise.all(
          blocks
            .filter((block) => block.type.includes("child_page"))
            .map((block) => this.loadPage(block.id))
        ),
        Promise.all(
          blocks
            .filter((block) => block.type.includes("child_database"))
            .map((block) => this.loadDatabase(block.id))
        ),
        Promise.all(
          blocks
            .filter(
              (block) => !["child_page", "child_database"].includes(block.type)
            )
            .map(async (block) => {
              const mdBlock = await this.loadBlock(block);
              let childDocuments: Document[] = [];

              if (block.has_children) {
                const block_id =
                  block.type === "synced_block" &&
                  block.synced_block?.synced_from?.block_id
                    ? block.synced_block.synced_from.block_id
                    : block.id;

                const childBlocksDocs = await this.loadBlocksAndDocs(
                  await getBlockChildren(this.notionClient, block_id, null)
                );

                mdBlock.children = childBlocksDocs.mdBlocks;
                childDocuments = childBlocksDocs.childDocuments;
              }

              return {
                mdBlocks: [mdBlock],
                childDocuments,
              };
            })
        ),
      ]);

    const allMdBlocks = blocksDocsArray
      .flat()
      .map((blockDoc) => blockDoc.mdBlocks);
    const childDocuments = blocksDocsArray
      .flat()
      .map((blockDoc) => blockDoc.childDocuments);

    return {
      mdBlocks: [...allMdBlocks.flat()],
      childDocuments: [
        ...childPageDocuments.flat(),
        ...childDatabaseDocuments.flat(),
        ...childDocuments.flat(),
      ],
    };
  }

  /**
   * Loads a Notion page and its child documents.
   * @param page The Notion page or page ID to load.
   * @returns A Promise that resolves to an array of Documents.
   */
  private async loadPage(page: string | PageObjectResponse) {
    // Check page is a page ID or a GetPageResponse
    const [pageData, pageId] =
      typeof page === "string"
        ? [this.notionClient.pages.retrieve({ page_id: page }), page]
        : [page, page.id];

    const [pageDetails, pageBlocks] = await Promise.all([
      pageData,
      getBlockChildren(this.notionClient, pageId, null),
    ]);

    if (!isFullPage(pageDetails)) return [];

    const { mdBlocks, childDocuments } = await this.loadBlocksAndDocs(
      pageBlocks
    );

    const mdStringObject = this.n2mClient.toMarkdownString(mdBlocks);

    const pageDocument = new Document({
      pageContent: mdStringObject.parent,
      metadata: this.parsePageDetails(pageDetails),
    });

    return [pageDocument, ...childDocuments];
  }

  /**
   * Loads a Notion database and its documents.
   * @param id The ID of the Notion database to load.
   * @returns A Promise that resolves to an array of Documents.
   */
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

  /**
   * Loads the documents from Notion based on the specified options.
   * @returns A Promise that resolves to an array of Documents.
   */
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
