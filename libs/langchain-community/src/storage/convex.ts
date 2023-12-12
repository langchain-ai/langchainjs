// eslint-disable-next-line import/no-extraneous-dependencies
import {
  FieldPaths,
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
  NamedTableInfo,
  TableNamesInDataModel,
  VectorIndexNames,
  makeFunctionReference,
} from "convex/server";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Value } from "convex/values";
import { BaseStore } from "@langchain/core/stores";

/**
 * Type that defines the config required to initialize the
 * ConvexKVStore class. It includes the table name,
 * index name, field name.
 */
export type ConvexKVStoreConfig<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>,
  IndexName extends VectorIndexNames<NamedTableInfo<DataModel, TableName>>,
  KeyFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  ValueFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  UpsertMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; document: object }
  >,
  LookupQuery extends FunctionReference<
    "query",
    "internal",
    { table: string; index: string; keyField: string; key: string },
    object[]
  >,
  DeleteManyMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; index: string; keyField: string; key: string }
  >
> = {
  readonly ctx: GenericActionCtx<DataModel>;
  /**
   * Defaults to "cache"
   */
  readonly table?: TableName;
  /**
   * Defaults to "byKey"
   */
  readonly index?: IndexName;
  /**
   * Defaults to "key"
   */
  readonly keyField?: KeyFieldName;
  /**
   * Defaults to "value"
   */
  readonly valueField?: ValueFieldName;
  /**
   * Defaults to `internal.langchain.db.upsert`
   */
  readonly upsert?: UpsertMutation;
  /**
   * Defaults to `internal.langchain.db.lookup`
   */
  readonly lookup?: LookupQuery;
  /**
   * Defaults to `internal.langchain.db.deleteMany`
   */
  readonly deleteMany?: DeleteManyMutation;
};

/**
 * Class that extends the BaseStore class to interact with a Convex
 * database. It provides methods for getting, setting, and deleting key value pairs,
 * as well as yielding keys from the database.
 */
export class ConvexKVStore<
  T extends Value,
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>,
  IndexName extends VectorIndexNames<NamedTableInfo<DataModel, TableName>>,
  KeyFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  ValueFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  UpsertMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; document: object }
  >,
  LookupQuery extends FunctionReference<
    "query",
    "internal",
    { table: string; index: string; keyField: string; key: string },
    object[]
  >,
  DeleteManyMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; index: string; keyField: string; key: string }
  >
> extends BaseStore<string, T> {
  lc_namespace = ["langchain", "storage", "convex"];

  private readonly ctx: GenericActionCtx<DataModel>;

  private readonly table: TableName;

  private readonly index: IndexName;

  private readonly keyField: KeyFieldName;

  private readonly valueField: ValueFieldName;

  private readonly upsert: UpsertMutation;

  private readonly lookup: LookupQuery;

  private readonly deleteMany: DeleteManyMutation;

  constructor(
    config: ConvexKVStoreConfig<
      DataModel,
      TableName,
      IndexName,
      KeyFieldName,
      ValueFieldName,
      UpsertMutation,
      LookupQuery,
      DeleteManyMutation
    >
  ) {
    super(config);
    this.ctx = config.ctx;
    this.table = config.table ?? ("cache" as TableName);
    this.index = config.index ?? ("byKey" as IndexName);
    this.keyField = config.keyField ?? ("key" as KeyFieldName);
    this.valueField = config.valueField ?? ("value" as ValueFieldName);
    this.upsert =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config.upsert ?? (makeFunctionReference("langchain/db:upsert") as any);
    this.lookup =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config.lookup ?? (makeFunctionReference("langchain/db:lookup") as any);
    this.deleteMany =
      config.deleteMany ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (makeFunctionReference("langchain/db:deleteMany") as any);
  }

  /**
   * Gets multiple keys from the Convex database.
   * @param keys Array of keys to be retrieved.
   * @returns An array of retrieved values.
   */
  async mget(keys: string[]) {
    return (await Promise.all(
      keys.map(async (key) => {
        const found = (await this.ctx.runQuery(this.lookup, {
          table: this.table,
          index: this.index,
          keyField: this.keyField,
          key,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)) as any;
        return found.length > 0 ? found[0][this.valueField] : undefined;
      })
    )) as (T | undefined)[];
  }

  /**
   * Sets multiple keys in the Convex database.
   * @param keyValuePairs Array of key-value pairs to be set.
   * @returns Promise that resolves when all keys have been set.
   */
  async mset(keyValuePairs: [string, T][]): Promise<void> {
    // TODO: Remove chunking when Convex handles the concurrent requests correctly
    const PAGE_SIZE = 16;
    for (let i = 0; i < keyValuePairs.length; i += PAGE_SIZE) {
      await Promise.all(
        keyValuePairs.slice(i, i + PAGE_SIZE).map(([key, value]) =>
          this.ctx.runMutation(this.upsert, {
            table: this.table,
            index: this.index,
            keyField: this.keyField,
            key,
            document: { [this.keyField]: key, [this.valueField]: value },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
        )
      );
    }
  }

  /**
   * Deletes multiple keys from the Convex database.
   * @param keys Array of keys to be deleted.
   * @returns Promise that resolves when all keys have been deleted.
   */
  async mdelete(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((key) =>
        this.ctx.runMutation(this.deleteMany, {
          table: this.table,
          index: this.index,
          keyField: this.keyField,
          key,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      )
    );
  }

  /**
   * Yields keys from the Convex database.
   * @param prefix Optional prefix to filter the keys.
   * @returns An AsyncGenerator that yields keys from the Convex database.
   */
  // eslint-disable-next-line require-yield
  async *yieldKeys(_prefix?: string): AsyncGenerator<string> {
    throw new Error("yieldKeys not implemented yet for ConvexKVStore");
  }
}
