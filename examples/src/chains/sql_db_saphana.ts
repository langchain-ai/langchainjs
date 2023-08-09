import { DataSource } from "typeorm";
import { OpenAI } from "langchain/llms/openai";
import { SqlDatabase } from "langchain/sql_db";
import { SqlDatabaseChain } from "langchain/chains/sql_db";

/**
 * This example uses a SAP HANA Cloud database. You can create a free trial database via https://developers.sap.com/tutorials/hana-cloud-deploying.html
 */
const datasource = new DataSource({
  type: "sap",
  host: "<ADD_YOURS_HERE>.hanacloud.ondemand.com",
  port: 443,
  username: "<ADD_YOURS_HERE>",
  password: "<ADD_YOURS_HERE>",
  schema: "<ADD_YOURS_HERE>",
  encrypt: true,
  extra: {
    sslValidateCertificate: false
  }
});

const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

const chain = new SqlDatabaseChain({
  llm: new OpenAI({ temperature: 0 }),
  database: db,
});

const res = await chain.run("How many tracks are there?");
console.log(res);
// There are 3503 tracks.
