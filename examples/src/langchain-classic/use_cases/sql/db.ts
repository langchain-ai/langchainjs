import { SqlDatabase } from "@langchain/classic/sql_db";

export const db = await SqlDatabase.fromOptionsParams({
  appDataSourceOptions: {
    type: "sqlite",
    database: "../../../../Chinook.db",
  },
});
