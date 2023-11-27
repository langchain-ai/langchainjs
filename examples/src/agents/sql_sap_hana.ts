import { OpenAI } from "langchain/llms/openai";
import { SqlDatabase } from "langchain/sql_db";
import { createSqlAgent, SqlToolkit } from "langchain/agents/toolkits/sql";
import { DataSource } from "typeorm";

/**
 * This example uses a SAP HANA Cloud database. You can create a free trial database via https://developers.sap.com/tutorials/hana-cloud-deploying.html
 *
 * You will need to add the following packages to your package.json as they are required when using typeorm with SAP HANA:
 *
 *    "hdb-pool": "^0.1.6",             (or latest version)
 *    "@sap/hana-client": "^2.17.22"    (or latest version)
 *
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
      sslValidateCertificate: false,
    },
  });

  // A custom SQL_PREFIX is required because we want to be explicit that a schema name is needed when querying HANA fool-proof (line 33)
  const custom_SQL_PREFIX = `You are an agent designed to interact with a SQL database.
        Given an input question, create a syntactically correct SAP HANA query to run, then look at the results of the query and return the answer.
        Unless the user specifies a specific number of examples they wish to obtain, always limit your query to at most {top_k} results using the LIMIT clause.
        You can order the results by a relevant column to return the most interesting examples in the database.
        Never query for all the columns from a specific table, only ask for a the few relevant columns given the question.
        You have access to tools for interacting with the database.
        Only use the below tools. Only use the information returned by the below tools to construct your final answer.
        You MUST double check your query before executing it. If you get an error while executing a query, rewrite the query and try again.
        Always use a schema name when running a query.
        
        DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.
        
        If the question does not seem related to the database, just return "I don't know" as the answer.`;

  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });

  const model = new OpenAI({ temperature: 0 });
  const toolkit = new SqlToolkit(db, model);
  const executor = createSqlAgent(model, toolkit, {
    prefix: custom_SQL_PREFIX,
  });

  const input = `List the total sales per country. Which country's customers spent the most?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input });

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
