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

type SimilarityModel<
  TModel extends Record<string, unknown> = Record<string, unknown>,
  TColumns extends ModelColumns<TModel> = ModelColumns<TModel>
> = Pick<TModel, keyof ObjectIntersect<TModel, TColumns>> & {
  _distance: number | null;
};

export class PrismaVectorStore<
  TModel extends Record<string, unknown>,
  TModelName extends string,
  TSelectModel extends ModelColumns<TModel>
> extends VectorStore {
  tableSql: Sql;

  vectorColumnSql: Sql;

  selectSql: Sql;

  idColumn: keyof TModel & string;

  contentColumn: keyof TModel & string;

  static IdColumn: typeof IdColumnSymbol = IdColumnSymbol;

  static ContentColumn: typeof ContentColumnSymbol = ContentColumnSymbol;

  protected db: PrismaClient;

  protected Prisma: PrismaNamespace;

  constructor(
    config: {
      db: PrismaClient;
      prisma: PrismaNamespace;
      tableName: TModelName;
      vectorColumnName: string;
      columns: TSelectModel;
    },
    embeddings: Embeddings
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

    this.tableSql = this.Prisma.raw(`"${config.tableName}"`);
    this.vectorColumnSql = this.Prisma.raw(`"${config.vectorColumnName}"`);

    this.selectSql = this.Prisma.raw(
      entries
        .map(([key, alias]) => (alias && key) || null)
        .filter((x): x is string => !!x)
        .map((key) => `"${key}"`)
        .join(", ")
    );
  }

  static withModel<TModel extends Record<string, unknown>>(db: PrismaClient) {
    function create<
      TPrisma extends PrismaNamespace,
      TColumns extends ModelColumns<TModel>
    >(
      config: {
        prisma: TPrisma;
        tableName: keyof TPrisma["ModelName"] & string;
        vectorColumnName: string;
        columns: TColumns;
      },
      embeddings: Embeddings
    ) {
      type ModelName = keyof TPrisma["ModelName"] & string;
      return new PrismaVectorStore<TModel, ModelName, TColumns>(
        { db, ...config },
        embeddings
      );
    }

    return { create };
  }

  async addModels(models: TModel[]) {
    return this.addDocuments(
      models.map((metadata) => {
        const pageContent = typeof metadata[this.contentColumn];
        if (pageContent !== "string")
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
    const idSql = this.Prisma.raw(`"${this.idColumn}"`);

    await this.db.$transaction(
      vectors.map(
        (vector, idx) => this.db.$executeRaw`
          UPDATE ${this.tableSql}
          SET ${this.vectorColumnSql} = ${`[${vector.join(",")}]`}::vector
          WHERE ${idSql} = ${documents[idx].metadata[this.idColumn]}
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

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document<SimilarityModel<TModel, TSelectModel>>, number][]> {
    const vectorQuery = `[${query.join(",")}]`;
    const articles = await this.db.$queryRaw<
      Array<SimilarityModel<TModel, TSelectModel>>
    >`
      SELECT ${this.selectSql}, ${this.vectorColumnSql} <=> ${vectorQuery}::vector as "_distance" 
      FROM ${this.tableSql}
      ORDER BY "_distance" ASC
      LIMIT ${k};
    `;

    const results: [Document<SimilarityModel<TModel, TSelectModel>>, number][] =
      [];
    for (const article of articles) {
      if (article._distance != null) {
        results.push([
          new Document({
            pageContent: article[this.contentColumn] as string | undefined,
            metadata: article,
          }),
          article._distance,
        ]);
      }
    }

    return results;
  }

  /**
   * @deprecated Not implemented in Prisma vectorstore, please use PrismaVectorStore.withModel instead
   */
  static fromTexts(
    _texts: string[],
    _metadatas: object[],
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "Not implemented in Prisma vectorstore, please use PrismaVectorStore.withModel instead"
    );
  }

  /**
   * @deprecated Not implemented in Prisma vectorstore, please use PrismaVectorStore.withModel instead
   */
  static fromDocuments(
    _docs: Document[],
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "Not implemented in Prisma vectorstore, please use PrismaVectorStore.withModel instead"
    );
  }
}
