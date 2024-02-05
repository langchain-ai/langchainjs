import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
export const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});
