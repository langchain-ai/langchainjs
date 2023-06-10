import { VectorStore } from "./base.js";
import { Document } from "../document.js";
import { type Embeddings } from "../embeddings/base.js";

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

type PrismaSqlFilter<TModel extends Record<string, unknown>> = {
  [K in keyof TModel]?: {
    equals?: TModel[K];
    lt?: TModel[K];
    lte?: TModel[K];
    gt?: TModel[K];
    gte?: TModel[K];
    not?: TModel[K];
  };
};

const OpMap = {
  equals: "=",
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

  async addDocuments(documents: Document<TModel>[]) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

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

  async similaritySearch(
    query: string,
    k = 4
  ): Promise<Document<SimilarityModel<TModel, TSelectModel>>[]> {
    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k
    );

    return results.map((result) => result[0]);
  }

  async similaritySearchWithScore(
    query: string,
    k?: number,
    filter?: TFilterModel
  ) {
    return super.similaritySearchWithScore(query, k, filter);
  }

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
          const colRaw = this.Prisma.raw(`"${key}"`);
          const opRaw = this.Prisma.raw(OpMap[opName as keyof typeof OpMap]);
          return this.Prisma.sql`${colRaw} ${opRaw} ${value}`;
        })
      ),
      " AND ",
      " WHERE "
    );
  }

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
