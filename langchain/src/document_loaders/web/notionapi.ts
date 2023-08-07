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

import Bottleneck from "bottleneck";
import { Document } from "../../document.js";
import { BaseDocumentLoaderWithEventEmitter } from "../base_with_event_emitter.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GuardType<T> = T extends (x: any, ...rest: any) => x is infer U
  ? U
  : never;

type BlockObjectResponse = GuardType<typeof isFullBlock>;
type PageObjectResponse = GuardType<typeof isFullPage>;

export type NotionAPIType = "database" | "page";

export type NotionAPILoaderOptions = {
  clientOptions: ConstructorParameters<typeof Client>[0];
  id: string;
  type: NotionAPIType;
  limiterOptions?: ConstructorParameters<typeof Bottleneck>[0];
};

export class NotionAPILoader extends BaseDocumentLoaderWithEventEmitter {
  private limiter: Bottleneck;

  private notionClient: Client;

  private n2mClient: NotionToMarkdown;

  private id: string;

  private type: NotionAPIType;

  private pageQueue: (string | PageObjectResponse)[];

  public pageQueueTotal: number;

  private documents: Document[];

  constructor(options: NotionAPILoaderOptions) {
    super();

    this.limiter = new Bottleneck(
      options.limiterOptions ?? { maxConcurrent: 64, minTime: 64 }
    );
    this.notionClient = new Client(options.clientOptions);
    this.n2mClient = new NotionToMarkdown({
      notionClient: this.notionClient,
      config: { parseChildPages: false, convertImagesToBase64: false },
    });
    this.id = options.id;
    this.type = options.type;
    this.pageQueue = [];
    this.pageQueueTotal = 0;
    if (this.type === "page") this.pageQueue.push(this.id);
    this.documents = [];
  }

  private addToQueue(...items: string[]) {
    this.pageQueue.push(...items);
    this.pageQueueTotal += items.length;
    this.emit("total_change", this.pageQueueTotal);
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

  private async loadBlock(block: BlockObjectResponse): Promise<MdBlock> {
    const mdBlock: MdBlock = {
      type: block.type,
      blockId: block.id,
      parent: await this.limiter.schedule(() =>
        this.n2mClient.blockToMarkdown(block)
      ),
      children: [],
    };

    if (block.has_children) {
      const block_id =
        block.type === "synced_block" &&
        block.synced_block?.synced_from?.block_id
          ? block.synced_block.synced_from.block_id
          : block.id;

      const childBlocks = await this.loadBlocks(
        await this.limiter.schedule(() =>
          getBlockChildren(this.notionClient, block_id, null)
        )
      );

      mdBlock.children = childBlocks;
    }

    return mdBlock;
  }

  private async loadBlocks(
    blocksResponse: ListBlockChildrenResponseResults
  ): Promise<MdBlock[]> {
    const blocks = blocksResponse.filter(isFullBlock);

    // Add child pages to queue
    const childPages = blocks
      .filter((block) => block.type.includes("child_page"))
      .map((block) => block.id);
    if (childPages.length > 0) this.addToQueue(...childPages);

    // Add child database pages to queue
    const childDatabases = blocks
      .filter((block) => block.type.includes("child_database"))
      .map((block) => this.limiter.schedule(() => this.loadDatabase(block.id)));

    // Load this block and child blocks
    const loadingMdBlocks = blocks
      .filter((block) => !["child_page", "child_database"].includes(block.type))
      .map((block) => this.loadBlock(block));

    const [mdBlocks] = await Promise.all([
      Promise.all(loadingMdBlocks),
      Promise.all(childDatabases),
    ]);

    return mdBlocks;
  }

  private async loadPage(page: string | PageObjectResponse) {
    // Check page is a page ID or a PageObjectResponse
    const [pageData, pageId] =
      typeof page === "string"
        ? [
            this.limiter.schedule(() =>
              this.notionClient.pages.retrieve({ page_id: page })
            ),
            page,
          ]
        : [page, page.id];

    const [pageDetails, pageBlocks] = await Promise.all([
      pageData,
      this.limiter.schedule(() =>
        getBlockChildren(this.notionClient, pageId, null)
      ),
    ]);

    if (!isFullPage(pageDetails)) return;
    this.emit("update", pageId, 0, pageBlocks.length);

    const mdBlocks = await this.loadBlocks(pageBlocks);
    const mdStringObject = this.n2mClient.toMarkdownString(mdBlocks);
    const pageDocument = new Document({
      pageContent: mdStringObject.parent,
      metadata: this.parsePageDetails(pageDetails),
    });

    this.documents.push(pageDocument);
    this.emit("load", this.documents.length);
  }

  private async loadDatabase(id: string) {
    try {
      for await (const page of iteratePaginatedAPI(
        this.notionClient.databases.query,
        {
          database_id: id,
          page_size: 50,
        }
      )) {
        this.addToQueue(page.id);
      }
    } catch (e) {
      console.log(e);
      // TODO: Catch and report api request errors
    }
  }

  async load(): Promise<Document[]> {
    if (this.type === "database") {
      await this.limiter.schedule(() => this.loadDatabase(this.id));
    }

    this.emit("begin", this.pageQueueTotal);

    let pageId = this.pageQueue.shift();
    while (pageId) {
      await this.loadPage(pageId);
      pageId = this.pageQueue.shift();
    }

    this.emit("end", this.documents.length);
    return this.documents;
  }
}
