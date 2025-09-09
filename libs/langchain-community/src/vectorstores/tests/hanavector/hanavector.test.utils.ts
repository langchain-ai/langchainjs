import {
  executeQuery,
  executeStatement,
  prepareQuery,
} from "../../../utils/hanautils.js";

export class HanaTestUtils {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async connectToHANA(client: any) {
    try {
      await new Promise<void>((resolve, reject) => {
        client.connect((err: Error) => {
          // Use arrow function here
          if (err) {
            reject(err);
          } else {
            // console.log("Connected to SAP HANA successfully.");
            resolve();
          }
        });
      });
    } catch (error) {
      // console.error("Connect error", error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async dropSchemaIfExists(client: any, schemaName: string) {
    const res = await executeQuery(
      client,
      `SELECT COUNT(*) AS COUNT FROM SYS.SCHEMAS WHERE SCHEMA_NAME = '${schemaName}'`
    );
    if (res[0].COUNT > 0) {
      await executeQuery(client, `DROP SCHEMA ${schemaName} CASCADE`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async dropOldTestSchemas(client: any, schemaPrefix: string) {
    const sql = `
    SELECT SCHEMA_NAME FROM SYS.SCHEMAS WHERE SCHEMA_NAME
    LIKE '${schemaPrefix.replace(/_/g, "__")}__%' ESCAPE '_' AND
    LOCALTOUTC(CREATE_TIME) < ?
    `;
    const stm = await prepareQuery(client, sql);
    const sqlParam = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await executeStatement(stm, [sqlParam]);
    for (const row of res) {
      await executeQuery(client, `DROP SCHEMA ${row.SCHEMA_NAME} CASCADE`);
    }
  }

  static async generateSchemaName(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    prefix: string
  ): Promise<string> {
    const sql = `
    SELECT REPLACE(CURRENT_UTCDATE, '-', '') || '_' || BINTOHEX(SYSUUID)
    AS GENERATED_ID
    FROM DUMMY;
    `;

    const result = await executeQuery(client, sql);
    const uniqueId = result[0].GENERATED_ID;
    return `${prefix}__${uniqueId}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async createAndSetSchema(client: any, schemaName: string) {
    await executeQuery(client, `CREATE SCHEMA ${schemaName}`);
    await executeQuery(client, `SET SCHEMA ${schemaName}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async dropTable(client: any, tableName: string) {
    await executeQuery(client, `DROP TABLE ${tableName}`);
  }
}
