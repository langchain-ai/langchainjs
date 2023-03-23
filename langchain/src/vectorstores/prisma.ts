import { VectorStore } from "../vectorstores";
import { Document } from "../document";
import { type Embeddings } from "../embeddings";

export const TypeId = Symbol("id");
export const TypeColumn = Symbol("content");

type BasicColumnType = typeof TypeId | typeof TypeColumn;

namespace Prisma {
  declare type Value = unknown;
  declare type RawValue = Value | Sql;

  export declare class Sql {
    strings: string[];
    constructor(
      rawStrings: ReadonlyArray<string>,
      rawValues: ReadonlyArray<RawValue>
    );
  }
}

type PrismaNamespace = {
  ModelName: Record<string, string>;
  Sql: typeof Prisma.Sql;
  raw: (sql: string) => Prisma.Sql;
};

type PrismaClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Promise<T>;
  $executeRaw(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Promise<any>;
  $transaction<P extends Promise<any>[]>(arg: [...P]): Promise<any>;
};

export class PrismaVectorStore<
  TModel extends Record<string, unknown> = Record<string, unknown>,
  TModelName extends string = string
> extends VectorStore {
  tableSql: Prisma.Sql;
  vectorColumnSql: Prisma.Sql;
  selectSql: Prisma.Sql;

  idColumn: keyof TModel;
  contentColumn: keyof TModel;

  constructor(
    protected db: PrismaClient,
    protected Prisma: PrismaNamespace,
    config: {
      tableName: TModelName;
      vectorColumnName: string;
      columns: {
        [K in keyof TModel]?: boolean | BasicColumnType;
      };
    },
    embeddings: Embeddings
  ) {
    super(embeddings, {});

    const entries = Object.entries(config.columns);
    this.idColumn = entries.find((i) => i[1] === TypeId)?.[0]!;
    this.contentColumn = entries.find((i) => i[1] === TypeColumn)?.[0]!;

    this.tableSql = Prisma.raw(`"${config.tableName}"`);
    this.vectorColumnSql = Prisma.raw(`"${config.vectorColumnName}"`);

    this.selectSql = Prisma.raw(
      entries
        .map(([key, alias]) => (alias && key) || null)
        .filter((x): x is string => !!x)
        .map((key) => `"${key}"`)
        .join(", ")
    );
  }

  async addDocuments(documents: Document[]) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]) {
    const idSql = this.Prisma.raw(`"${this.idColumn as string}"`);

    this.db.$transaction(
      vectors.map(
        (vector) => this.db.$executeRaw`
          UPDATE ${this.tableSql}
          SET ${this.vectorColumnSql} = ${`[${vector.join(",")}]`}::vector
          WHERE ${idSql} = ${documents[0].metadata.id}
        `
      )
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const vectorQuery = `[${query.join(",")}]`;
    const articles = await this.db.$queryRaw<
      Array<TModel & { _distance: number | null }>
    >`
      SELECT ${this.selectSql}, ${this.vectorColumnSql} <=> ${vectorQuery}::vector as "_distance" 
      FROM ${this.tableSql}
      ORDER BY "_distance" ASC
      LIMIT ${k};
    `;

    const results: [Document, number][] = [];
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
}
