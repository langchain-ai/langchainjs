/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-explicit-any */
import oracledb from "oracledb";
import { TextSplitter, TextSplitterParams } from "./text_splitter.js";

/**
 * Split text into smaller pieces
 * @example
 * ```typescript
 * const splitter = new OracleTextSplitter(conn, params);
 * let chunks = await splitter.splitText(doc.pageContent);
 * ```
 */
export class OracleTextSplitter extends TextSplitter {
  protected conn: oracledb.Connection;

  protected pref: Record<string, unknown>;

  static lc_name() {
    return "OracleTextSplitter";
  }

  constructor(
    conn: oracledb.Connection,
    pref: Record<string, unknown>,
    fields?: TextSplitterParams
  ) {
    super(fields);
    this.conn = conn;
    this.pref = pref;
  }

  async splitText(text: string) {
    const chunks: string[] = [];

    const result = await this.conn.execute(
      <string>(
        `select t.column_value as data from dbms_vector_chain.utl_to_chunks(:content, :pref) t`
      ),
      <oracledb.BindParameters>{
        content: { val: text, dir: oracledb.BIND_IN, type: oracledb.CLOB },
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
        chunks.push(chunk.chunk_data);
      }
    }
    return chunks;
  }
}
