import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "postgres",
  host: "localhost", // or the appropriate hostname
  port: 5432,
  schema: "public", // default schema is "public", change if necessary
  username: "postgres", // default username for PostgreSQL
  password: "", // if you set a password, specify it here
  database: "postgres", // specify the database you want to connect to
});
export const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});
