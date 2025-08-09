/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-explicit-any */
import oracledb from "oracledb";

/**
 * Generate a summary using models through Oracle
 * @example
 * ```typescript
 * const model = new OracleSummary(conn, params, proxy);
 * let summary = await model.getSummary(doc.pageContent);
 * ```
 */
export class OracleSummary {
  protected conn: oracledb.Connection;

  protected pref: Record<string, unknown>;

  protected proxy: string;

  constructor(
    conn: oracledb.Connection,
    pref: Record<string, unknown>,
    proxy = ""
  ) {
    this.conn = conn;
    this.pref = pref;
    this.proxy = proxy;
  }

  async getSummary(text: string) {
    if (this.proxy) {
      await this.conn.execute("begin utl_http.set_proxy(:proxy); end;", {
        proxy: this.proxy,
      });
    }

    let summary = "";
    const result = await this.conn.execute(
      <string>(
        `select dbms_vector_chain.utl_to_summary(:content, :pref) data from dual`
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
        [summary] = row;
      }
    }
    return summary;
  }
}
