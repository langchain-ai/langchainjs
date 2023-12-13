import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { Callbacks } from "@langchain/core/callbacks/manager";

const IdColumnSymbol = Symbol("id");
const ContentColumnSymbol = Symbol("content");

type ColumnSymbol = typeof IdColumnSymbol | typeof ContentColumnSymbol;

declare type Value = unknown;
declare type RawValue = Value | Sql;

declare class Sql {
  strings: string[];

  constructor(
    rawStrings: ReadonlyArray<string>,
    rawValues: ReadonlyArray<RawValue>
  );
}

type PrismaNamespace = {
  ModelName: Record<string, string>;
  Sql: typeof Sql;
  raw: (sql: string) => Sql;
  join: (
    values: RawValue[],
    separator?: string,
    prefix?: string,
    suffix?: string
  ) => Sql;
  sql: (strings: ReadonlyArray<string>, ...values: RawValue[]) => Sql;
};

type PrismaClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Sql,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...values: any[]
  ): Promise<T>;
  $executeRaw(
    query: TemplateStringsArray | Sql,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...values: any[]
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction<P extends Promise<any>[]>(arg: [...P]): Promise<any>;
};

type ObjectIntersect<A, B> = {
  [P in keyof A & keyof B]: A[P] | B[P];
};

type ModelColumns<TModel extends Record<string, unknown>> = {
  [K in keyof TModel]?: true | ColumnSymbol;
};

export type PrismaSqlFilter<TModel extends Record<string, unknown>> = {
  [K in keyof TModel]?: {
    equals?: TModel[K];
    in?: TModel[K][];
    isNull?: TModel[K];
    isNotNull?: TModel[K];
    like?: TModel[K];
    lt?: TModel[K];
    lte?: TModel[K];
    gt?: TModel[K];
    gte?: TModel[K];
    not?: TModel[K];
  };
};

const OpMap = {
  equals: "=",
  in: "IN",
  isNull: "IS NULL",
  isNotNull: "IS NOT NULL",
  like: "LIKE",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
  not: "<>",
};

type SimilarityModel<
  TModel extends Record<string, unknown> = Record<string, unknown>,
  TColumns extends ModelColumns<TModel> = ModelColumns<TModel>
> = Pick<TModel, keyof ObjectIntersect<TModel, TColumns>> & {
  _distance: number | null;
};

type DefaultPrismaVectorStore = PrismaVectorStore<
  Record<string, unknown>,
  string,
  ModelColumns<Record<string, unknown>>,
  PrismaSqlFilter<Record<string, unknown>>
>;

/**
 * A specific implementation of the VectorStore class that is designed to
 * work with Prisma. It provides methods for adding models, documents, and
 * vectors, as well as for performing similarity searches.
 */
export class PrismaVectorStore<
  TModel extends Record<string, unknown>,
  TModelName extends string,
  TSelectModel extends ModelColumns<TModel>,
  TFilterModel extends PrismaSqlFilter<TModel>
> extends VectorStore {
  protected tableName: string;

  protected vectorColumnName: string;

  protected selectColumns: string[];

  filter?: TFilterModel;

  idColumn: keyof TModel & string;

  contentColumn: keyof TModel & string;

  static IdColumn: typeof IdColumnSymbol = IdColumnSymbol;

  static ContentColumn: typeof ContentColumnSymbol = ContentColumnSymbol;

  protected db: PrismaClient;

  protected Prisma: PrismaNamespace;

  _vectorstoreType(): string {
    return "prisma";
  }

  constructor(
    embeddings: Embeddings,
    config: {
      db: PrismaClient;
      prisma: PrismaNamespace;
      tableName: TModelName;
      vectorColumnName: string;
      columns: TSelectModel;
      filter?: TFilterModel;
    }
  ) {
    super(embeddings, {});

    this.Prisma = config.prisma;
    this.db = config.db;

    const entries = Object.entries(config.columns);
    const idColumn = entries.find((i) => i[1] === IdColumnSymbol)?.[0];
    const contentColumn = entries.find(
      (i) => i[1] === ContentColumnSymbol
    )?.[0];

    if (idColumn == null) throw new Error("Missing ID column");
    if (contentColumn == null) throw new Error("Missing content column");

    this.idColumn = idColumn;
    this.contentColumn = contentColumn;

    this.tableName = config.tableName;
    this.vectorColumnName = config.vectorColumnName;

    this.selectColumns = entries
      .map(([key, alias]) => (alias && key) || null)
      .filter((x): x is string => !!x);

    if (config.filter) {
      this.filter = config.filter;
    }
  }

  /**
   * Creates a new PrismaVectorStore with the specified model.
   * @param db The PrismaClient instance.
   * @returns An object with create, fromTexts, and fromDocuments methods.
   */
  static withModel<TModel extends Record<string, unknown>>(db: PrismaClient) {
    function create<
      TPrisma extends PrismaNamespace,
      TColumns extends ModelColumns<TModel>,
      TFilters extends PrismaSqlFilter<TModel>
    >(
      embeddings: Embeddings,
      config: {
        prisma: TPrisma;
        tableName: keyof TPrisma["ModelName"] & string;
        vectorColumnName: string;
        columns: TColumns;
        filter?: TFilters;
      }
    ) {
      type ModelName = keyof TPrisma["ModelName"] & string;
      return new PrismaVectorStore<TModel, ModelName, TColumns, TFilters>(
        embeddings,
        { ...config, db }
      );
    }

    async function fromTexts<
      TPrisma extends PrismaNamespace,
      TColumns extends ModelColumns<TModel>
    >(
      texts: string[],
      metadatas: TModel[],
      embeddings: Embeddings,
      dbConfig: {
        prisma: TPrisma;
        tableName: keyof TPrisma["ModelName"] & string;
        vectorColumnName: string;
        columns: TColumns;
      }
    ) {
      const docs: Document[] = [];
      for (let i = 0; i < texts.length; i += 1) {
        const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
        const newDoc = new Document({
          pageContent: texts[i],
          metadata,
        });
        docs.push(newDoc);
      }

      return PrismaVectorStore.fromDocuments(docs, embeddings, {
        ...dbConfig,
        db,
      });
    }

    async function fromDocuments<
      TPrisma extends PrismaNamespace,
      TColumns extends ModelColumns<TModel>,
      TFilters extends PrismaSqlFilter<TModel>
    >(
      docs: Document<TModel>[],
      embeddings: Embeddings,
      dbConfig: {
        prisma: TPrisma;
        tableName: keyof TPrisma["ModelName"] & string;
        vectorColumnName: string;
        columns: TColumns;
      }
    ) {
      type ModelName = keyof TPrisma["ModelName"] & string;
      const instance = new PrismaVectorStore<
        TModel,
        ModelName,
        TColumns,
        TFilters
      >(embeddings, { ...dbConfig, db });
      await instance.addDocuments(docs);
      return instance;
    }

    return { create, fromTexts, fromDocuments };
  }

  /**
   * Adds the specified models to the store.
   * @param models The models to add.
   * @returns A promise that resolves when the models have been added.
   */
  async addModels(models: TModel[]) {
    return this.addDocuments(
      models.map((metadata) => {
        const pageContent = metadata[this.contentColumn];
        if (typeof pageContent !== "string")
          throw new Error("Content column must be a string");
        return new Document({ pageContent, metadata });
      })
    );
  }

  /**
   * Adds the specified documents to the store.
   * @param documents The documents to add.
   * @returns A promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document<TModel>[]) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Adds the specified vectors to the store.
   * @param vectors The vectors to add.
   * @param documents The documents associated with the vectors.
   * @returns A promise that resolves when the vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document<TModel>[]) {
    // table name, column name cannot be parametrised
    // these fields are thus not escaped by Prisma and can be dangerous if user input is used
    const idColumnRaw = this.Prisma.raw(`"${this.idColumn}"`);
    const tableNameRaw = this.Prisma.raw(`"${this.tableName}"`);
    const vectorColumnRaw = this.Prisma.raw(`"${this.vectorColumnName}"`);

    await this.db.$transaction(
      vectors.map(
        (vector, idx) => this.db.$executeRaw`
          UPDATE ${tableNameRaw}
          SET ${vectorColumnRaw} = ${`[${vector.join(",")}]`}::vector
          WHERE ${idColumnRaw} = ${documents[idx].metadata[this.idColumn]}
        `
      )
    );
  }

  /**
   * Performs a similarity search with the specified query.
   * @param query The query to use for the similarity search.
   * @param k The number of results to return.
   * @param _filter The filter to apply to the results.
   * @param _callbacks The callbacks to use during the search.
   * @returns A promise that resolves with the search results.
   */
  async similaritySearch(
    query: string,
    k = 4,
    _filter: this["FilterType"] | undefined = undefined, // not used. here to make the interface compatible with the other stores
    _callbacks: Callbacks | undefined = undefined // implement passing to embedQuery later
  ): Promise<Document<SimilarityModel<TModel, TSelectModel>>[]> {
    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k
    );

    return results.map((result) => result[0]);
  }

  /**
   * Performs a similarity search with the specified query and returns the
   * results along with their scores.
   * @param query The query to use for the similarity search.
   * @param k The number of results to return.
   * @param filter The filter to apply to the results.
   * @param _callbacks The callbacks to use during the search.
   * @returns A promise that resolves with the search results and their scores.
   */
  async similaritySearchWithScore(
    query: string,
    k?: number,
    filter?: TFilterModel,
    _callbacks: Callbacks | undefined = undefined // implement passing to embedQuery later
  ) {
    return super.similaritySearchWithScore(query, k, filter);
  }

  /**
   * Performs a similarity search with the specified vector and returns the
   * results along with their scores.
   * @param query The vector to use for the similarity search.
   * @param k The number of results to return.
   * @param filter The filter to apply to the results.
   * @returns A promise that resolves with the search results and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: TFilterModel
  ): Promise<[Document<SimilarityModel<TModel, TSelectModel>>, number][]> {
    // table name, column names cannot be parametrised
    // these fields are thus not escaped by Prisma and can be dangerous if user input is used
    const vectorColumnRaw = this.Prisma.raw(`"${this.vectorColumnName}"`);
    const tableNameRaw = this.Prisma.raw(`"${this.tableName}"`);
    const selectRaw = this.Prisma.raw(
      this.selectColumns.map((x) => `"${x}"`).join(", ")
    );

    const vector = `[${query.join(",")}]`;
    const articles = await this.db.$queryRaw<
      Array<SimilarityModel<TModel, TSelectModel>>
    >(
      this.Prisma.join(
        [
          this.Prisma.sql`
            SELECT ${selectRaw}, ${vectorColumnRaw} <=> ${vector}::vector as "_distance"
            FROM ${tableNameRaw}
          `,
          this.buildSqlFilterStr(filter ?? this.filter),
          this.Prisma.sql`
            ORDER BY "_distance" ASC
            LIMIT ${k};
          `,
        ].filter((x) => x != null),
        ""
      )
    );

    const results: [Document<SimilarityModel<TModel, TSelectModel>>, number][] =
      [];
    for (const article of articles) {
      if (article._distance != null && article[this.contentColumn] != null) {
        results.push([
          new Document({
            pageContent: article[this.contentColumn] as string,
            metadata: article,
          }),
          article._distance,
        ]);
      }
    }

    return results;
  }

  buildSqlFilterStr(filter?: TFilterModel) {
    if (filter == null) return null;
    return this.Prisma.join(
      Object.entries(filter).flatMap(([key, ops]) =>
        Object.entries(ops).map(([opName, value]) => {
          // column name, operators cannot be parametrised
          // these fields are thus not escaped by Prisma and can be dangerous if user input is used
          const opNameKey = opName as keyof typeof OpMap;
          const colRaw = this.Prisma.raw(`"${key}"`);
          const opRaw = this.Prisma.raw(OpMap[opNameKey]);

          switch (OpMap[opNameKey]) {
            case OpMap.in: {
              if (
                !Array.isArray(value) ||
                !value.every((v) => typeof v === "string")
              ) {
                throw new Error(
                  `Invalid filter: IN operator requires an array of strings. Received: ${JSON.stringify(
                    value,
                    null,
                    2
                  )}`
                );
              }
              return this.Prisma.sql`${colRaw} ${opRaw} (${this.Prisma.join(
                value
              )})`;
            }
            case OpMap.isNull:
            case OpMap.isNotNull:
              return this.Prisma.sql`${colRaw} ${opRaw}`;
            default:
              return this.Prisma.sql`${colRaw} ${opRaw} ${value}`;
          }
        })
      ),
      " AND ",
      " WHERE "
    );
  }

  /**
   * Creates a new PrismaVectorStore from the specified texts.
   * @param texts The texts to use to create the store.
   * @param metadatas The metadata for the texts.
   * @param embeddings The embeddings to use.
   * @param dbConfig The database configuration.
   * @returns A promise that resolves with the new PrismaVectorStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings,
    dbConfig: {
      db: PrismaClient;
      prisma: PrismaNamespace;
      tableName: string;
      vectorColumnName: string;
      columns: ModelColumns<Record<string, unknown>>;
    }
  ): Promise<DefaultPrismaVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }

    return PrismaVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Creates a new PrismaVectorStore from the specified documents.
   * @param docs The documents to use to create the store.
   * @param embeddings The embeddings to use.
   * @param dbConfig The database configuration.
   * @returns A promise that resolves with the new PrismaVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: {
      db: PrismaClient;
      prisma: PrismaNamespace;
      tableName: string;
      vectorColumnName: string;
      columns: ModelColumns<Record<string, unknown>>;
    }
  ): Promise<DefaultPrismaVectorStore> {
    const instance = new PrismaVectorStore(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
