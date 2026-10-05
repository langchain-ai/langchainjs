---
"@langchain/classic": patch
---

Use the SQLite prompt for every SQLite data source in `SqlDatabaseChain`

`getPromptTemplateFromDataSource` returned the SQLite prompt only for a
typeorm data source of type `"sqlite"`. typeorm 1.x removed that driver in
favour of `"better-sqlite3"`, so with typeorm 1.x the chain always fell back
to the generic prompt for SQLite. The SQLite prompt is now used for
`"sqlite"`, `"better-sqlite3"` and `"sqljs"`, the same types whose tables
`SqlDatabase` already reads with SQLite's schema query. typeorm 0.3 data
sources of type `"sqlite"` work as before.
