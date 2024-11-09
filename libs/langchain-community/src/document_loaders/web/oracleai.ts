import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Parser, DomHandler } from "htmlparser2";
import oracledb from "oracledb";
import crypto from "crypto";
import fs from "fs";



interface Metadata {
    [key: string]: string;
}

interface OutBinds {
    mdata: oracledb.Lob | null;
    text: oracledb.Lob | null;
}

class ParseOracleDocMetadata {
    private metadata: Metadata;
    private match: boolean;

    constructor() {
        this.metadata = {};
        this.match = false;
    }

    private handleStartTag(tag: string, attrs: { name: string; value: string | null }[]) {
        if (tag === "meta") {
            let entry: string | undefined;
            let content: string | null = null;

            attrs.forEach(({ name, value }) => {
                if (name === "name") entry = value ?? "";
                if (name === "content") content = value;
            });

            if (entry) {
                this.metadata[entry] = content ?? "N/A";
            }
        } else if (tag === "title") {
            this.match = true;
        }
    }

    private handleData(data: string) {
        if (this.match) {
            this.metadata["title"] = data;
            this.match = false;
        }
    }

    public getMetadata(): Metadata {
        return this.metadata;
    }

    public parse(htmlString: string): void {
        // We add this method to incorperate the feed method of HTMLParser in Python
        interface Attribute {
            name: string;
            value: string | null;
        }

        interface ParserOptions {
            onopentag: (name: string, attrs: Record<string, string>) => void;
            ontext: (text: string) => void;
        }

        const parser = new Parser(
            {
                onopentag: (name: string, attrs: Record<string, string>) =>
                    this.handleStartTag(
                        name,
                        Object.entries(attrs).map(([name, value]): Attribute => ({
                            name,
                            value: value as string | null,
                        }))
                    ),
                ontext: (text: string) => this.handleData(text),
            } as ParserOptions,
            { decodeEntities: true }
        );
        parser.write(htmlString);
        parser.end();
    }
    
}



class OracleDocReader {
  static generateObjectId(inputString: string | null = null) {
    const outLength = 32; // Output length
    const hashLen = 8; // Hash value length

    if (!inputString) {
      inputString = Array.from(
        { length: 16 },
        () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
          .charAt(Math.floor(Math.random() * 62))
      ).join("");
    }

    // Timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const timestampBin = Buffer.alloc(4);
    timestampBin.writeUInt32BE(timestamp);

    // Hash value
    const hashValBin = crypto.createHash("sha256").update(inputString).digest();
    const truncatedHashVal = hashValBin.slice(0, hashLen);

    // Counter
    const counterBin = Buffer.alloc(4);
    counterBin.writeUInt32BE(Math.floor(Math.random() * Math.pow(2, 32)));

    // Binary object ID
    const objectId = Buffer.concat([timestampBin, truncatedHashVal, counterBin]);
    let objectIdHex = objectId.toString("hex").padStart(outLength, "0");

    return objectIdHex.slice(0, outLength);
  }

// Helper function to read CLOB data
  static async readClob(lob: oracledb.Lob): Promise<string> {
    return new Promise((resolve, reject) => {
      let clobData = "";
      lob.setEncoding("utf8");
      lob.on("data", (chunk) => {
        clobData += chunk;
      });
      lob.on("end", () => {
        resolve(clobData);
      });
      lob.on("error", (err) => {
        reject(err);
      });
    });
  }
 

  static async readFile(
    conn: oracledb.Connection,
    filePath: string,
    params: Record<string, any>
  ): Promise<Document | null> {
    let metadata: Metadata = {};

    try {
      // Read the file as binary data
      const data = await new Promise<Buffer>((resolve, reject) => {
        const fs = require("fs");
        fs.readFile(filePath, (err: NodeJS.ErrnoException | null, data: Buffer) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      if (!data) {
        return new Document("", metadata);
      }

      const bindVars = {
        blob: { dir: oracledb.BIND_IN, type: oracledb.DB_TYPE_BLOB, val: data },
        pref: { dir: oracledb.BIND_IN, val: JSON.stringify(params) },
        mdata: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_CLOB },
        text: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_CLOB },
      };

      // Execute the PL/SQL block
      const result = await conn.execute(
        `
        declare
          input blob;
        begin
          input := :blob;
          :mdata := dbms_vector_chain.utl_to_text(input, json(:pref));
          :text := dbms_vector_chain.utl_to_text(input);
        end;`,
        bindVars
      );

      const outBinds = result.outBinds as OutBinds;
      const mdataLob = outBinds.mdata;
      const textLob = outBinds.text;

      // Read and parse metadata
      let docData = mdataLob ? await OracleDocReader.readClob(mdataLob) : "";
      let textData = textLob ? await OracleDocReader.readClob(textLob) : "";

      if (
        docData.startsWith("<!DOCTYPE html") ||
        docData.startsWith("<HTML>")
      ) {
        const parser = new ParseOracleDocMetadata();
        parser.parse(docData);
        metadata = parser.getMetadata();
      }

      // Execute a query to get the current session user
      const userResult = await conn.execute<{ USERNAME: string }>(
        `SELECT USER FROM dual`
      );

      const username = userResult.rows?.[0]?.USERNAME;
      const docId = OracleDocReader.generateObjectId(`${username}$${filePath}`);
      metadata["_oid"] = docId;
      metadata["_file"] = filePath;

      if (!textData) {
        return Document("", metadata)
    } else {
        return Document(textData, metadata)
    }
    } catch (ex) {
      console.error(`An exception occurred: ${ex}`);
      console.error(`Skip processing ${filePath}`);
      return null;
    }
  }

}
