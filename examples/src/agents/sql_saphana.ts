import { OpenAI } from "langchain/llms/openai";
import { SqlDatabase } from "langchain/sql_db";
import { createSqlAgent, SqlToolkit } from "langchain/agents/toolkits/sql";
import { DataSource } from "typeorm";

/**
 * This example uses a SAP HANA Cloud database. You can create a free trial database via https://developers.sap.com/tutorials/hana-cloud-deploying.html
 */
export const run = async () => {

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

  const model = new OpenAI({ temperature: 0 });
  const toolkit = new SqlToolkit(db, model);
  const executor = createSqlAgent(model, toolkit);

  const input = `List the total sales per country. Which country's customers spent the most?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );

  await datasource.destroy();
};
