/* eslint-disable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line import/no-extraneous-dependencies
import {
  DocumentByInfo,
  DocumentByName,
  FieldPaths,
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
  NamedTableInfo,
  TableNamesInDataModel,
  IndexNames,
  makeFunctionReference,
} from "convex/server";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

/**
 * Type that defines the config required to initialize the
 * ConvexChatMessageHistory class. At minimum it needs a sessionId
 * and an ActionCtx.
 */
export type ConvexChatMessageHistoryInput<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel> = "messages",
  IndexName extends IndexNames<
    NamedTableInfo<DataModel, TableName>
  > = "bySessionId",
  SessionIdFieldName extends FieldPaths<
    NamedTableInfo<DataModel, TableName>
  > = "sessionId",
  MessageTextFieldName extends FieldPaths<
    NamedTableInfo<DataModel, TableName>
  > = "message",
  InsertMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; document: object }
  > = any,
  LookupQuery extends FunctionReference<
    "query",
    "internal",
    { table: string; index: string; keyField: string; key: string },
    object[]
  > = any,
  DeleteManyMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; index: string; keyField: string; key: string }
  > = any
> = {
  readonly ctx: GenericActionCtx<DataModel>;
  readonly sessionId: DocumentByName<DataModel, TableName>[SessionIdFieldName];
  /**
   * Defaults to "messages"
   */
  readonly table?: TableName;
  /**
   * Defaults to "bySessionId"
   */
  readonly index?: IndexName;
  /**
   * Defaults to "sessionId"
   */
  readonly sessionIdField?: SessionIdFieldName;
  /**
   * Defaults to "message"
   */
  readonly messageTextFieldName?: MessageTextFieldName;
  /**
   * Defaults to `internal.langchain.db.insert`
   */
  readonly insert?: InsertMutation;
  /**
   * Defaults to `internal.langchain.db.lookup`
   */
  readonly lookup?: LookupQuery;
  /**
   * Defaults to `internal.langchain.db.deleteMany`
   */
  readonly deleteMany?: DeleteManyMutation;
};

export class ConvexChatMessageHistory<
  DataModel extends GenericDataModel,
  SessionIdFieldName extends FieldPaths<
    NamedTableInfo<DataModel, TableName>
  > = "sessionId",
  TableName extends TableNamesInDataModel<DataModel> = "messages",
  IndexName extends IndexNames<
    NamedTableInfo<DataModel, TableName>
  > = "bySessionId",
  MessageTextFieldName extends FieldPaths<
    NamedTableInfo<DataModel, TableName>
  > = "message",
  InsertMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; document: object }
  > = any,
  LookupQuery extends FunctionReference<
    "query",
    "internal",
    { table: string; index: string; keyField: string; key: string },
    object[]
  > = any,
  DeleteManyMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; index: string; keyField: string; key: string }
  > = any
> extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "convex"];

  private readonly ctx: GenericActionCtx<DataModel>;

  private readonly sessionId: DocumentByInfo<
    NamedTableInfo<DataModel, TableName>
  >[SessionIdFieldName];

  private readonly table: TableName;

  private readonly index: IndexName;

  private readonly sessionIdField: SessionIdFieldName;

  private readonly messageTextFieldName: MessageTextFieldName;

  private readonly insert: InsertMutation;

  private readonly lookup: LookupQuery;

  private readonly deleteMany: DeleteManyMutation;

  constructor(
    config: ConvexChatMessageHistoryInput<
      DataModel,
      TableName,
      IndexName,
      SessionIdFieldName,
      MessageTextFieldName,
      InsertMutation,
      LookupQuery,
      DeleteManyMutation
    >
  ) {
    super();
    this.ctx = config.ctx;
    this.sessionId = config.sessionId;
    this.table = config.table ?? ("messages" as TableName);
    this.index = config.index ?? ("bySessionId" as IndexName);
    this.sessionIdField =
      config.sessionIdField ?? ("sessionId" as SessionIdFieldName);
    this.messageTextFieldName =
      config.messageTextFieldName ?? ("message" as MessageTextFieldName);
    this.insert =
      config.insert ?? (makeFunctionReference("langchain/db:insert") as any);
    this.lookup =
      config.lookup ?? (makeFunctionReference("langchain/db:lookup") as any);
    this.deleteMany =
      config.deleteMany ??
      (makeFunctionReference("langchain/db:deleteMany") as any);
  }

  async getMessages(): Promise<BaseMessage[]> {
    const convexDocuments: any[] = await this.ctx.runQuery(this.lookup, {
      table: this.table,
      index: this.index,
      keyField: this.sessionIdField,
      key: this.sessionId,
    } as any);

    return mapStoredMessagesToChatMessages(
      convexDocuments.map((doc) => doc[this.messageTextFieldName])
    );
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const messages = mapChatMessagesToStoredMessages([message]);
    // TODO: Remove chunking when Convex handles the concurrent requests correctly
    const PAGE_SIZE = 16;
    for (let i = 0; i < messages.length; i += PAGE_SIZE) {
      await Promise.all(
        messages.slice(i, i + PAGE_SIZE).map((message) =>
          this.ctx.runMutation(this.insert, {
            table: this.table,
            document: {
              [this.sessionIdField]: this.sessionId,
              [this.messageTextFieldName]: message,
            },
          } as any)
        )
      );
    }
  }

  async clear(): Promise<void> {
    await this.ctx.runMutation(this.deleteMany, {
      table: this.table,
      index: this.index,
      keyField: this.sessionIdField,
      key: this.sessionId,
    } as any);
  }
}
