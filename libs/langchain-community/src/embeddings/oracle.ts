/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import oracledb from "oracledb";

/**
 * Generate embeddings using models through Oracle
 * @example
 * ```typescript
 * const embedder = new OracleEmbeddings(conn, params, proxy);
 * const embed = await embedder.embedQuery(chunk);
 * ```
 */
export class OracleEmbeddings extends Embeddings {
  protected conn: oracledb.Connection;

  protected pref: Record<string, unknown>;

  protected proxy: string;

  constructor(
    conn: oracledb.Connection,
    pref: Record<string, unknown>,
    proxy = "",
    fields: EmbeddingsParams = {}
  ) {
    super(fields ?? {});
    this.conn = conn;
    this.pref = pref;
    this.proxy = proxy;
  }

  static async loadOnnxModel(
    conn: oracledb.Connection,
    dir: string,
    onnx_file: string,
    model_name: string
  ) {
    await conn.execute(
      `begin
         dbms_data_mining.drop_model(model_name => :model, force => true);
         dbms_vector.load_onnx_model(:path, :filename, :model,
         json('{"function" : "embedding", "embeddingOutput" : "embedding" , "input": {"input": ["DATA"]}}'));
       end;`,
      { path: dir, filename: onnx_file, model: model_name }
    );
  }

  async _embed(texts: string[]) {
    // replace newlines, which can negatively affect performance.
    const clean_texts = texts.map((text) => text.replace(/\n/g, " "));

    if (this.proxy) {
      await this.conn.execute("begin utl_http.set_proxy(:proxy); end;", {
        proxy: this.proxy,
      });
    }

    const embeddings = [];

    if (oracledb.thin) {
      // thin mode, can't use batching

      for (const clean_text of clean_texts) {
        const result = await this.conn.execute(
          <string>(
            `select t.column_value as data from dbms_vector_chain.utl_to_embeddings(:content, :pref) t`
          ),
          <oracledb.BindParameters>{
            content: clean_text,
            pref: { val: this.pref, type: oracledb.DB_TYPE_JSON },
          },
          <oracledb.ExecuteOptions>(
            (<unknown>{ fetchInfo: { DATA: { type: oracledb.STRING } } })
          )
        );
        const rows: any = result.rows;
        if (Symbol.iterator in Object(rows)) {
          for (const row of rows) {
            const [chunk_str] = row;
            const chunk = JSON.parse(chunk_str);
            const vec = JSON.parse(chunk.embed_vector);
            embeddings.push(vec);
          }
        }
      }
    } else {
      // thick mode, can use batching

      const chunks: string[] = [];
      for (const [i, clean_text] of clean_texts.entries()) {
        const chunk = {
          chunk_id: i,
          chunk_data: clean_text,
        };
        chunks.push(JSON.stringify(chunk));
      }

      const VectorArrayT = await this.conn.getDbObjectClass(
        "SYS.VECTOR_ARRAY_T"
      );
      const inputs = new VectorArrayT(chunks);

      const result = await this.conn.execute(
        <string>(
          `select t.column_value as data from dbms_vector_chain.utl_to_embeddings(:content, :pref) t`
        ),
        <oracledb.BindParameters>{
          content: inputs,
          pref: { val: this.pref, type: oracledb.DB_TYPE_JSON },
        },
        <oracledb.ExecuteOptions>(
          (<unknown>{ fetchInfo: { DATA: { type: oracledb.STRING } } })
        )
      );
      const rows: any = result.rows;
      if (Symbol.iterator in Object(rows)) {
        for (const row of rows) {
          const [chunk_str] = row;
          const chunk = JSON.parse(chunk_str);
          const vec = JSON.parse(chunk.embed_vector);
          embeddings.push(vec);
        }
      }
    }

    return embeddings;
  }

  /**
   * Method that takes a document as input and returns a promise that
   * resolves to an embedding for the document. It calls the _embed method
   * with the document as the input and returns the first embedding in the
   * resulting array.
   * @param document Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  embedQuery(document: string) {
    return this._embed([document]).then((embeddings) => embeddings[0]);
  }

  /**
   * Method that takes an array of documents as input and returns a promise
   * that resolves to a 2D array of embeddings for each document. It calls
   * the _embed method with the documents as the input.
   * @param documents Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  embedDocuments(documents: string[]) {
    return this._embed(documents);
  }
}
