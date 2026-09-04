import { SqlDatabase } from "@langchain/classic/sql_db";

const db = await SqlDatabase.fromOptionsParams({
  appDataSourceOptions: {
    type: "better-sqlite3",
    database: "../../../../Chinook.db",
  },
});
console.log(db.allTables.map((t) => t.tableName));
/**
[
  'Album',       'Artist',
  'Customer',    'Employee',
  'Genre',       'Invoice',
  'InvoiceLine', 'MediaType',
  'Playlist',    'PlaylistTrack',
  'Track'
]
 */
