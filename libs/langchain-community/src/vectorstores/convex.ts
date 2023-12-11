// eslint-disable-next-line import/no-extraneous-dependencies
import {
  DocumentByInfo,
  FieldPaths,
  FilterExpression,
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
  GenericTableInfo,
  NamedTableInfo,
  NamedVectorIndex,
  TableNamesInDataModel,
  VectorFilterBuilder,
  VectorIndexNames,
  makeFunctionReference,
} from "convex/server";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

/**
 * Type that defines the config required to initialize the
 * ConvexVectorStore class. It includes the table name,
 * index name, text field name, and embedding field name.
 */
export type ConvexVectorStoreConfig<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>,
  IndexName extends VectorIndexNames<NamedTableInfo<DataModel, TableName>>,
  TextFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  EmbeddingFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  MetadataFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  InsertMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; document: object }
  >,
  GetQuery extends FunctionReference<
    "query",
    "internal",
    { id: string },
    object | null
  >
> = {
  readonly ctx: GenericActionCtx<DataModel>;
  /**
   * Defaults to "documents"
   */
  readonly table?: TableName;
  /**
   * Defaults to "byEmbedding"
   */
  readonly index?: IndexName;
  /**
   * Defaults to "text"
   */
  readonly textField?: TextFieldName;
  /**
   * Defaults to "embedding"
   */
  readonly embeddingField?: EmbeddingFieldName;
  /**
   * Defaults to "metadata"
   */
  readonly metadataField?: MetadataFieldName;
  /**
   * Defaults to `internal.langchain.db.insert`
   */
  readonly insert?: InsertMutation;
  /**
   * Defaults to `internal.langchain.db.get`
   */
  readonly get?: GetQuery;
};

/**
 * Class that is a wrapper around Convex storage and vector search. It is used
 * to insert embeddings in Convex documents with a vector search index,
 * and perform a vector search on them.
 *
 * ConvexVectorStore does NOT implement maxMarginalRelevanceSearch.
 */
export class ConvexVectorStore<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>,
  IndexName extends VectorIndexNames<NamedTableInfo<DataModel, TableName>>,
  TextFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  EmbeddingFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  MetadataFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
  InsertMutation extends FunctionReference<
    "mutation",
    "internal",
    { table: string; document: object }
  >,
  GetQuery extends FunctionReference<
    "query",
    "internal",
    { id: string },
    object | null
  >
> extends VectorStore {
  /**
   * Type that defines the filter used in the
   * similaritySearchVectorWithScore and maxMarginalRelevanceSearch methods.
   * It includes limit, filter and a flag to include embeddings.
   */
  declare FilterType: {
    filter?: (
      q: VectorFilterBuilder<
        DocumentByInfo<GenericTableInfo>,
        NamedVectorIndex<NamedTableInfo<DataModel, TableName>, IndexName>
      >
    ) => FilterExpression<boolean>;
    includeEmbeddings?: boolean;
  };

  private readonly ctx: GenericActionCtx<DataModel>;

  private readonly table: TableName;

  private readonly index: IndexName;

  private readonly textField: TextFieldName;

  private readonly embeddingField: EmbeddingFieldName;

  private readonly metadataField: MetadataFieldName;

  private readonly insert: InsertMutation;

  private readonly get: GetQuery;

  _vectorstoreType(): string {
    return "convex";
  }

  constructor(
    embeddings: Embeddings,
    config: ConvexVectorStoreConfig<
      DataModel,
      TableName,
      IndexName,
      TextFieldName,
      EmbeddingFieldName,
      MetadataFieldName,
      InsertMutation,
      GetQuery
    >
  ) {
    super(embeddings, config);
    this.ctx = config.ctx;
    this.table = config.table ?? ("documents" as TableName);
    this.index = config.index ?? ("byEmbedding" as IndexName);
    this.textField = config.textField ?? ("text" as TextFieldName);
    this.embeddingField =
      config.embeddingField ?? ("embedding" as EmbeddingFieldName);
    this.metadataField =
      config.metadataField ?? ("metadata" as MetadataFieldName);
    this.insert =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config.insert ?? (makeFunctionReference("langchain/db:insert") as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.get = config.get ?? (makeFunctionReference("langchain/db:get") as any);
  }

  /**
   * Add vectors and their corresponding documents to the Convex table.
   * @param vectors Vectors to be added.
   * @param documents Corresponding documents to be added.
   * @returns Promise that resolves when the vectors and documents have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const convexDocuments = vectors.map((embedding, idx) => ({
      [this.textField]: documents[idx].pageContent,
      [this.embeddingField]: embedding,
      [this.metadataField]: documents[idx].metadata,
    }));
    // TODO: Remove chunking when Convex handles the concurrent requests correctly
    const PAGE_SIZE = 16;
    for (let i = 0; i < convexDocuments.length; i += PAGE_SIZE) {
      await Promise.all(
        convexDocuments.slice(i, i + PAGE_SIZE).map((document) =>
          this.ctx.runMutation(this.insert, {
            table: this.table,
            document,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
        )
      );
    }
  }

  /**
   * Add documents to the Convex table. It first converts
   * the documents to vectors using the embeddings and then calls the
   * addVectors method.
   * @param documents Documents to be added.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Similarity search on the vectors stored in the
   * Convex table. It returns a list of documents and their
   * corresponding similarity scores.
   * @param query Query vector for the similarity search.
   * @param k Number of nearest neighbors to return.
   * @param filter Optional filter to be applied.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    const idsAndScores = await this.ctx.vectorSearch(this.table, this.index, {
      vector: query,
      limit: k,
      filter: filter?.filter,
    });

    const documents = await Promise.all(
      idsAndScores.map(({ _id }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.ctx.runQuery(this.get, { id: _id } as any)
      )
    );

    return documents.map(
      (
        {
          [this.textField]: text,
          [this.embeddingField]: embedding,
          [this.metadataField]: metadata,
        },
        idx
      ) => [
        new Document({
          pageContent: text as string,
          metadata: {
            ...metadata,
            ...(filter?.includeEmbeddings ? { embedding } : null),
          },
        }),
        idsAndScores[idx]._score,
      ]
    );
  }

  /**
   * Static method to create an instance of ConvexVectorStore from a
   * list of texts. It first converts the texts to vectors and then adds
   * them to the Convex table.
   * @param texts List of texts to be converted to vectors.
   * @param metadatas Metadata for the texts.
   * @param embeddings Embeddings to be used for conversion.
   * @param dbConfig Database configuration for Convex.
   * @returns Promise that resolves to a new instance of ConvexVectorStore.
   */
  static async fromTexts<
    DataModel extends GenericDataModel,
    TableName extends TableNamesInDataModel<DataModel>,
    IndexName extends VectorIndexNames<NamedTableInfo<DataModel, TableName>>,
    TextFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
    EmbeddingFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
    MetadataFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
    InsertMutation extends FunctionReference<
      "mutation",
      "internal",
      { table: string; document: object }
    >,
    GetQuery extends FunctionReference<
      "query",
      "internal",
      { id: string },
      object | null
    >
  >(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: ConvexVectorStoreConfig<
      DataModel,
      TableName,
      IndexName,
      TextFieldName,
      EmbeddingFieldName,
      MetadataFieldName,
      InsertMutation,
      GetQuery
    >
  ): Promise<
    ConvexVectorStore<
      DataModel,
      TableName,
      IndexName,
      TextFieldName,
      EmbeddingFieldName,
      MetadataFieldName,
      InsertMutation,
      GetQuery
    >
  > {
    const docs = texts.map(
      (text, i) =>
        new Document({
          pageContent: text,
          metadata: Array.isArray(metadatas) ? metadatas[i] : metadatas,
        })
    );
    return ConvexVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create an instance of ConvexVectorStore from a
   * list of documents. It first converts the documents to vectors and then
   * adds them to the Convex table.
   * @param docs List of documents to be converted to vectors.
   * @param embeddings Embeddings to be used for conversion.
   * @param dbConfig Database configuration for Convex.
   * @returns Promise that resolves to a new instance of ConvexVectorStore.
   */
  static async fromDocuments<
    DataModel extends GenericDataModel,
    TableName extends TableNamesInDataModel<DataModel>,
    IndexName extends VectorIndexNames<NamedTableInfo<DataModel, TableName>>,
    TextFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
    EmbeddingFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
    MetadataFieldName extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
    InsertMutation extends FunctionReference<
      "mutation",
      "internal",
      { table: string; document: object }
    >,
    GetQuery extends FunctionReference<
      "query",
      "internal",
      { id: string },
      object | null
    >
  >(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: ConvexVectorStoreConfig<
      DataModel,
      TableName,
      IndexName,
      TextFieldName,
      EmbeddingFieldName,
      MetadataFieldName,
      InsertMutation,
      GetQuery
    >
  ): Promise<
    ConvexVectorStore<
      DataModel,
      TableName,
      IndexName,
      TextFieldName,
      EmbeddingFieldName,
      MetadataFieldName,
      InsertMutation,
      GetQuery
    >
  > {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
