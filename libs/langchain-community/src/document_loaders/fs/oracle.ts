import { Document } from "@langchain/core/documents";
import fs from "node:fs";
import path from "node:path";
import oracledb from "oracledb";
import * as htmlparser2 from "htmlparser2";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

function* listDir(dir: string): Generator<string> {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    if (file.isDirectory()) {
      yield* listDir(path.join(dir, file.name));
    } else {
      yield path.join(dir, file.name);
    }
  }
}

/**
 * Load documents from a file, a directory, or a table
 * If the document isn't a plain text file such as a PDF,
 * a plain text version will be extracted using utl_to_text
 * @example
 * ```typescript
 * const loader = new OracleDocLoader(conn, params);
 * const docs = await loader.load();
 * ```
 */
export class OracleDocLoader extends BaseDocumentLoader {
  protected conn: oracledb.Connection;

  protected pref: Record<string, any>;

  constructor(conn: oracledb.Connection, pref: Record<string, any>) {
    super();
    this.conn = conn;
    this.pref = pref;
  }

  /**
   * A method that loads the text file or blob and returns a promise that
   * resolves to an array of `Document` instances. It reads the text from
   * the file or blob using the `readFile` function from the
   * `node:fs/promises` module or the `text()` method of the blob. It then
   * parses the text using the `parse()` method and creates a `Document`
   * instance for each parsed page. The metadata includes the source of the
   * text (file path or blob) and, if there are multiple pages, the line
   * number of each page.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  async load() {
    const docs = [];

    if ("file" in this.pref) {
      // don't specify an encoding to use binary
      const data = fs.readFileSync(this.pref.file);

      const result = await this.conn.execute(
        <string>(
          `select dbms_vector_chain.utl_to_text(:content, json(:pref)) text, dbms_vector_chain.utl_to_text(:content, json('{"plaintext": "false"}')) metadata from dual`
        ),
        <oracledb.BindParameters>{
          content: { val: data, dir: oracledb.BIND_IN, type: oracledb.BLOB },
          pref: JSON.stringify(this.pref),
        },
        <oracledb.ExecuteOptions>(<unknown>{
          resultSet: true, // return a ResultSet (default is false)
          fetchInfo: {
            TEXT: { type: oracledb.STRING },
            METADATA: { type: oracledb.STRING },
          },
        })
      );

      const rs = result.resultSet;
      let row;
      if (rs != null) {
        while ((row = await rs.getRow())) {
          const [plain_text, metadata] = await this._extract(row);
          docs.push(
            new Document({
              pageContent: <string>plain_text,
              metadata: <Record<string, any>>metadata,
            })
          );
        }
        await rs.close();
      }
    } else if ("dir" in this.pref) {
      for (const file of listDir(this.pref.dir)) {
        // don't specify an encoding to use binary
        const data = fs.readFileSync(file);

        const result = await this.conn.execute(
          <string>(
            `select dbms_vector_chain.utl_to_text(:content, json(:pref)) text, dbms_vector_chain.utl_to_text(:content, json('{"plaintext": "false"}')) metadata from dual`
          ),
          <oracledb.BindParameters>{
            content: { val: data, dir: oracledb.BIND_IN, type: oracledb.BLOB },
            pref: JSON.stringify(this.pref),
          },
          <oracledb.ExecuteOptions>(<unknown>{
            resultSet: true, // return a ResultSet (default is false)
            fetchInfo: {
              TEXT: { type: oracledb.STRING },
              METADATA: { type: oracledb.STRING },
            },
          })
        );

        const rs = result.resultSet;
        let row;
        if (rs != null) {
          while ((row = await rs.getRow())) {
            const [plain_text, metadata] = await this._extract(row);
            docs.push(
              new Document({
                pageContent: <string>plain_text,
                metadata: <Record<string, any>>metadata,
              })
            );
          }
          await rs.close();
        }
      }
    } else if ("tablename" in this.pref) {
      if (!("owner" in this.pref) || !("colname" in this.pref)) {
        throw new Error(`Invalid preferences: missing owner or colname`);
      }
      // SQL doesn't accept backslash to escape a double quote (\"). If string contains \" change to "
      if (
        this.pref.tablename.startsWith('\\"') &&
        this.pref.tablename.endsWith('\\"')
      ) {
        this.pref.tablename = this.pref.tablename.replaceAll("\\", "");
      }
      const result = await this.conn.execute(
        <string>(
          `select dbms_vector_chain.utl_to_text(t.${this.pref.colname}, json(:pref)) text, dbms_vector_chain.utl_to_text(t.${this.pref.colname}, json('{"plaintext": "false"}')) metadata from ${this.pref.owner}.${this.pref.tablename} t`
        ),
        <oracledb.BindParameters>{
          pref: JSON.stringify(this.pref),
        },
        <oracledb.ExecuteOptions>(<unknown>{
          resultSet: true, // return a ResultSet (default is false)
          fetchInfo: {
            TEXT: { type: oracledb.STRING },
            METADATA: { type: oracledb.STRING },
          },
        })
      );

      const rs = result.resultSet;
      let row;
      if (rs != null) {
        while ((row = await rs.getRow())) {
          const [plain_text, metadata] = await this._extract(row);
          docs.push(
            new Document({
              pageContent: <string>plain_text,
              metadata: <Record<string, any>>metadata,
            })
          );
        }
        await rs.close();
      }
    } else {
      throw new Error(`Invalid preferences: missing file or tablename`);
    }

    return docs;
  }

  // extract plain text and metadata from a row
  async _extract(row: any) {
    let plain_text = "";
    let metadata: Record<string, string> = {};

    if (row != null) {
      [plain_text] = row;
      const [, html_metadata] = row;

      const parser = new htmlparser2.Parser({
        onopentag(name, attributes) {
          if (name === "meta" && attributes.name !== undefined) {
            metadata[attributes.name] = attributes.content;
          }
        },
      });
      parser.write(html_metadata);
      parser.end();
    }

    return [plain_text, metadata];
  }
}
