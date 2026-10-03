---
"@langchain/pgvector": patch
---

Make `buildFilterClauses` `protected` so that additional metadata filter operators can be added by subclassing `PGVectorStore`.

`buildFilterClauses` is the single place every metadata filter operator passes through, and it was `private`, so there was no way to add one without replacing the whole builder. This is the extension point requested in #11710, which needs a `jsonbContains` operator for Postgres JSONB containment (`@>`). The operator itself is not added here; the following subclass supplies it:

```ts
class JsonbContainsStore extends PGVectorStore {
  protected override buildFilterClauses(filter, paramOffset = 0) {
    const whereClauses: string[] = [];
    const parameters: unknown[] = [];
    let paramCount = paramOffset;

    const remaining = { ...filter };
    for (const [key, value] of Object.entries(remaining)) {
      if (
        typeof value !== "object" ||
        value === null ||
        !("jsonbContains" in value)
      ) {
        continue;
      }
      const { jsonbContains, ...rest } = value;
      delete (remaining as Record<string, unknown>)[key];
      if (Object.keys(rest).length > 0) {
        (remaining as Record<string, unknown>)[key] = rest;
      }

      paramCount += 1;
      parameters.push(key);
      const keyPlaceholder = `$${paramCount}`;
      paramCount += 1;
      parameters.push(JSON.stringify(jsonbContains));
      whereClauses.push(
        `(${this.metadataColumnName} -> ${keyPlaceholder}) @> $${paramCount}::jsonb`
      );
    }

    const base = super.buildFilterClauses(remaining, paramCount);
    return {
      whereClauses: [...whereClauses, ...base.whereClauses],
      parameters: [...parameters, ...base.parameters],
      paramCount: base.paramCount,
    };
  }
}

await store.similaritySearch(query, 10, {
  profile: { jsonbContains: { tier: "gold" } },
});

// -> (metadata -> $3) @> $4::jsonb  with $3='profile', $4='{"tier":"gold"}'
```

Three things an override has to get right, all documented on the method: continue the parameter numbering from `paramOffset` rather than restarting it, remove your own operator from a shallow copy of the filter before delegating to `super`, and bind both keys and values as parameters. Note also that `PGVectorStore.initialize` constructs a `PGVectorStore` directly, so calling it on a subclass returns a base instance and discards the override; a subclass has to be constructed with `new` and initialize its own table.

Also fixes two pre-existing problems in the filter builder:

- `in: []` and `notIn: []` produced invalid SQL (`IN ()`) and threw a raw database syntax error. An empty `in` list now matches nothing and an empty `notIn` list excludes nothing.
- Filter entries that the builder cannot translate were dropped silently, so a query returned every row instead of the intended subset. The store now emits a `console.warn` naming each ignored entry, whether it was an unknown operator or a known operator given a value of the wrong type. Filtering behavior is otherwise unchanged.
