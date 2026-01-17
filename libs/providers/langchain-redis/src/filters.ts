/**
 * Filter expression classes for advanced metadata filtering in Redis vector stores.
 *
 * These classes provide a type-safe way to construct Redis query filters for vector similarity search.
 * They generate RediSearch query syntax that can be used to filter documents based on metadata fields.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/vector-search/
 *
 * @example
 * ```typescript
 * // Simple tag filter
 * const filter = Tag("category").eq("electronics");
 *
 * // Numeric range filter
 * const priceFilter = Num("price").between(50, 200);
 *
 * // Combining filters with AND
 * const complexFilter = Tag("category").eq("electronics").and(Num("price").lt(100));
 *
 * // Combining filters with OR
 * const orFilter = Tag("brand").eq("Apple").or(Tag("brand").eq("Samsung"));
 *
 * // Custom filter with raw RediSearch syntax
 * const customFilter = Custom("(@category:{electronics} @price:[0 100])");
 * ```
 */

/**
 * Base class for all filter expressions.
 *
 * All filter types extend this class and implement the `toString()` method
 * to generate the appropriate RediSearch query syntax.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/
 */
export abstract class FilterExpression {
  /**
   * Discriminator property for type-safe filter identification.
   * Each filter type has a unique filterType value.
   */
  abstract readonly filterType: string;

  /**
   * Converts the filter expression to a RediSearch query string.
   *
   * @returns The RediSearch query string representation of this filter
   */
  abstract toString(): string;

  /**
   * Combine this filter with another using AND logic.
   *
   * In RediSearch, AND operations are represented by space-separated conditions
   * within parentheses: `(condition1 condition2)`
   *
   * @param other - The filter expression to combine with
   * @returns A new AndFilter combining both expressions
   *
   * @example
   * ```typescript
   * const filter = Tag("category").eq("books").and(Num("price").lt(30));
   * // Generates: (@category:{books} @price:[-inf 30])
   * ```
   */
  and(other: FilterExpression): FilterExpression {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new AndFilter([this, other]);
  }

  /**
   * Combine this filter with another using OR logic.
   *
   * In RediSearch, OR operations are represented by pipe-separated conditions
   * within parentheses: `(condition1|condition2)`
   *
   * @param other - The filter expression to combine with
   * @returns A new OrFilter combining both expressions
   *
   * @example
   * ```typescript
   * const filter = Tag("category").eq("books").or(Tag("category").eq("electronics"));
   * // Generates: (@category:{books}|@category:{electronics})
   * ```
   */
  or(other: FilterExpression): FilterExpression {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new OrFilter([this, other]);
  }
}

/**
 * Logical AND filter for combining multiple filter conditions.
 *
 * Combines two filter expressions with AND logic. In RediSearch, this is represented
 * by space-separated conditions within parentheses.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/combined/#and
 *
 * @example
 * ```typescript
 * const filter = new AndFilter(
 *   Tag("category").eq("electronics"),
 *   Num("price").between(100, 500)
 * );
 * // Generates: (@category:{electronics} @price:[100 500])
 * ```
 */
export class AndFilter extends FilterExpression {
  readonly filterType = "and" as const;

  constructor(public readonly filters: [FilterExpression, FilterExpression]) {
    super();
  }

  toString(): string {
    const leftStr = this.filters[0].toString();
    const rightStr = this.filters[1].toString();

    // Handle wildcard cases - if either side is a wildcard, return the other side
    if (leftStr === "*") return rightStr;
    if (rightStr === "*") return leftStr;

    return `(${leftStr} ${rightStr})`;
  }
}

/**
 * Logical OR filter for combining alternative filter conditions.
 *
 * Combines two filter expressions with OR logic. In RediSearch, this is represented
 * by pipe-separated conditions within parentheses.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/combined/#or
 *
 * @example
 * ```typescript
 * const filter = new OrFilter(
 *   Tag("brand").eq("Apple"),
 *   Tag("brand").eq("Samsung")
 * );
 * // Generates: (@brand:{Apple}|@brand:{Samsung})
 * ```
 */
export class OrFilter extends FilterExpression {
  readonly filterType = "or" as const;

  constructor(public readonly filters: [FilterExpression, FilterExpression]) {
    super();
  }

  toString(): string {
    const leftStr = this.filters[0].toString();
    const rightStr = this.filters[1].toString();

    // Handle wildcard cases - if either side is a wildcard, the entire OR is a wildcard
    if (leftStr === "*" || rightStr === "*") return "*";

    return `(${leftStr}|${rightStr})`;
  }
}

/**
 * Tag filter for exact matching on tag fields.
 *
 * Tag fields in Redis are used for exact-match filtering on categorical data.
 * They support efficient filtering on multiple values using OR logic within the tag set.
 *
 * Tag fields must be indexed with the TAG type in the metadata schema.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/advanced-concepts/tags/
 *
 * @example
 * ```typescript
 * // Single value
 * const filter = new TagFilter("category", "electronics");
 * // Generates: @category:{electronics}
 *
 * // Multiple values (OR logic)
 * const filter = new TagFilter("category", ["electronics", "books"]);
 * // Generates: @category:{electronics|books}
 *
 * // Negation
 * const filter = new TagFilter("category", "electronics", true);
 * // Generates: (-@category:{electronics})
 *
 * // Using the convenience method
 * const filter = Tag("category").eq("electronics");
 * const notFilter = Tag("category").ne("books");
 * ```
 */
export class TagFilter extends FilterExpression {
  readonly filterType = "tag" as const;

  constructor(
    private field: string,
    private values: string | string[] | Set<string>,
    private negate: boolean = false
  ) {
    super();
  }

  /**
   * Creates a builder object for constructing tag filters.
   *
   * @param field - The name of the tag field to filter on
   * @returns An object with `eq` and `ne` methods for creating filters
   */
  static create(field: string) {
    return {
      eq: (values: string | string[] | Set<string>) =>
        new TagFilter(field, values, false),
      ne: (values: string | string[] | Set<string>) =>
        new TagFilter(field, values, true),
    };
  }

  toString(): string {
    if (
      !this.values ||
      (Array.isArray(this.values) && this.values.length === 0) ||
      (this.values &&
        typeof this.values === "object" &&
        "size" in this.values &&
        this.values.size === 0)
    ) {
      return "*"; // Return wildcard for empty filters
    }

    let valueStr: string;
    if (typeof this.values === "string") {
      valueStr = this.values;
    } else if (Array.isArray(this.values)) {
      valueStr = this.values.join("|");
    } else {
      valueStr = Array.from(this.values).join("|");
    }

    const filter = `@${this.field}:{${valueStr}}`;
    return this.negate ? `(-${filter})` : filter;
  }
}

/**
 * Numeric filter for range and exact matching on numeric fields.
 *
 * Numeric fields in Redis support range queries and exact matching on numerical values.
 * They use interval notation where square brackets `[` `]` indicate inclusive bounds
 * and parentheses `(` indicate exclusive bounds.
 *
 * Numeric fields must be indexed with the NUMERIC type in the metadata schema.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/exact-match/#numeric-field
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/range/
 *
 * @example
 * ```typescript
 * // Exact match
 * const filter = new NumericFilter("price", "eq", 99.99);
 * // Generates: @price:[99.99 99.99]
 *
 * // Greater than (exclusive)
 * const filter = new NumericFilter("price", "gt", 50);
 * // Generates: @price:[(50 +inf]
 *
 * // Less than or equal (inclusive)
 * const filter = new NumericFilter("price", "lte", 100);
 * // Generates: @price:[-inf 100]
 *
 * // Range (inclusive on both ends)
 * const filter = new NumericFilter("price", "between", [50, 200]);
 * // Generates: @price:[50 200]
 *
 * // Using convenience methods
 * const filter = Num("price").between(50, 200);
 * const filter2 = Num("rating").gte(4.5);
 * ```
 */
export class NumericFilter extends FilterExpression {
  readonly filterType = "numeric" as const;

  constructor(
    private field: string,
    private operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "between",
    private value: number | [number, number],
    private negate: boolean = false
  ) {
    super();
  }

  /**
   * Creates a builder object for constructing numeric filters.
   *
   * @param field - The name of the numeric field to filter on
   * @returns An object with comparison methods (eq, ne, gt, gte, lt, lte, between)
   */
  static create(field: string) {
    return {
      eq: (value: number) => new NumericFilter(field, "eq", value),
      ne: (value: number) => new NumericFilter(field, "ne", value),
      gt: (value: number) => new NumericFilter(field, "gt", value),
      gte: (value: number) => new NumericFilter(field, "gte", value),
      lt: (value: number) => new NumericFilter(field, "lt", value),
      lte: (value: number) => new NumericFilter(field, "lte", value),
      between: (min: number, max: number) =>
        new NumericFilter(field, "between", [min, max]),
    };
  }

  toString(): string {
    let rangeStr: string;

    switch (this.operator) {
      case "eq":
        rangeStr = `[${this.value} ${this.value}]`;
        break;
      case "ne":
        return `(-@${this.field}:[${this.value} ${this.value}])`;
      case "gt":
        // Exclusive lower bound using parenthesis
        rangeStr = `[(${this.value} +inf]`;
        break;
      case "gte":
        // Inclusive lower bound using square bracket
        rangeStr = `[${this.value} +inf]`;
        break;
      case "lt":
        // Exclusive upper bound using parenthesis
        rangeStr = `[-inf (${this.value}]`;
        break;
      case "lte":
        // Inclusive upper bound using square bracket
        rangeStr = `[-inf ${this.value}]`;
        break;
      case "between":
        if (Array.isArray(this.value)) {
          rangeStr = `[${this.value[0]} ${this.value[1]}]`;
        } else {
          throw new Error("Between operator requires array of two numbers");
        }
        break;
      default:
        throw new Error(`Unknown numeric operator: ${this.operator}`);
    }

    const filter = `@${this.field}:${rangeStr}`;
    return this.negate ? `(-${filter})` : filter;
  }
}

/**
 * Text filter for full-text search on text fields.
 *
 * Text fields in Redis support various types of text matching including exact phrases,
 * wildcard patterns, and fuzzy matching. Text fields are tokenized and support
 * full-text search capabilities.
 *
 * Text fields must be indexed with the TEXT type in the metadata schema.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/full-text/
 *
 * @example
 * ```typescript
 * // Exact phrase match
 * const filter = new TextFilter("title", "wireless headphones", "exact");
 * // Generates: @title:("wireless headphones")
 *
 * // Wildcard match (use * for any characters)
 * const filter = new TextFilter("title", "head*", "wildcard");
 * // Generates: @title:(head*)
 *
 * // Fuzzy match (allows typos/variations)
 * const filter = new TextFilter("title", "headphone", "fuzzy");
 * // Generates: @title:(%%headphone%%)
 *
 * // Word match (tokenized search)
 * const filter = new TextFilter("description", "bluetooth wireless", "match");
 * // Generates: @title:(bluetooth wireless)
 *
 * // Using convenience methods
 * const filter = Text("title").exact("wireless headphones");
 * const filter2 = Text("title").wildcard("*phone*");
 * const filter3 = Text("description").fuzzy("blutooth");
 * ```
 */
export class TextFilter extends FilterExpression {
  readonly filterType = "text" as const;

  constructor(
    private field: string,
    private query: string,
    private operator: "match" | "wildcard" | "fuzzy" | "exact" = "exact",
    private negate: boolean = false
  ) {
    super();
  }

  /**
   * Creates a builder object for constructing text filters.
   *
   * @param field - The name of the text field to filter on
   * @returns An object with text search methods (eq, ne, match, wildcard, fuzzy)
   */
  static create(field: string) {
    return {
      eq: (query: string) => new TextFilter(field, query, "exact"),
      ne: (query: string) => new TextFilter(field, query, "exact", true),
      match: (query: string) => new TextFilter(field, query, "match"),
      wildcard: (query: string) => new TextFilter(field, query, "wildcard"),
      fuzzy: (query: string) => new TextFilter(field, query, "fuzzy"),
    };
  }

  toString(): string {
    if (!this.query || this.query.trim() === "") {
      return "*"; // Return wildcard for empty queries
    }

    let queryStr: string;
    switch (this.operator) {
      case "exact":
        // Exact phrase match using quotes
        queryStr = `"${this.query}"`;
        break;
      case "match":
        // Tokenized word matching
        queryStr = this.query;
        break;
      case "wildcard":
        // Wildcard matching - wildcards should be included in the query string
        queryStr = this.query;
        break;
      case "fuzzy":
        // Fuzzy matching using %% prefix and suffix
        queryStr = `%%${this.query}%%`;
        break;
      default:
        queryStr = this.query;
    }

    const filter = `@${this.field}:(${queryStr})`;
    return this.negate ? `(-${filter})` : filter;
  }
}

/**
 * Geographic filter for location-based searches.
 *
 * Geo fields in Redis support radius-based geographic queries. They store coordinates
 * as longitude,latitude pairs and allow filtering based on distance from a point.
 *
 * Geo fields must be indexed with the GEO type in the metadata schema.
 * Coordinates should be stored as "longitude,latitude" strings or [lon, lat] arrays.
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/geo-spatial/
 *
 * @example
 * ```typescript
 * // Find locations within 10km of San Francisco
 * const filter = new GeoFilter("location", -122.4194, 37.7749, 10, "km");
 * // Generates: @location:[-122.4194 37.7749 10 km]
 *
 * // Find locations within 5 miles of New York
 * const filter = new GeoFilter("store_location", -74.0060, 40.7128, 5, "mi");
 * // Generates: @store_location:[-74.0060 40.7128 5 mi]
 *
 * // Find locations outside a radius (negation)
 * const filter = new GeoFilter("location", -122.4194, 37.7749, 50, "km", true);
 * // Generates: (-@location:[-122.4194 37.7749 50 km])
 *
 * // Using convenience methods
 * const filter = Geo("location").within(-122.4194, 37.7749, 10, "km");
 * const filter2 = Geo("location").outside(-74.0060, 40.7128, 100, "mi");
 * ```
 */
export class GeoFilter extends FilterExpression {
  readonly filterType = "geo" as const;

  constructor(
    private field: string,
    private longitude: number,
    private latitude: number,
    private radius: number,
    private unit: "km" | "mi" | "m" | "ft" = "km",
    private negate: boolean = false
  ) {
    super();
  }

  /**
   * Creates a builder object for constructing geographic filters.
   *
   * @param field - The name of the geo field to filter on
   * @returns An object with `within` and `outside` methods for creating geo filters
   */
  static create(field: string) {
    return {
      within: (
        longitude: number,
        latitude: number,
        radius: number,
        unit: "km" | "mi" | "m" | "ft" = "km"
      ) => new GeoFilter(field, longitude, latitude, radius, unit),
      outside: (
        longitude: number,
        latitude: number,
        radius: number,
        unit: "km" | "mi" | "m" | "ft" = "km"
      ) => new GeoFilter(field, longitude, latitude, radius, unit, true),
    };
  }

  toString(): string {
    const filter = `@${this.field}:[${this.longitude} ${this.latitude} ${this.radius} ${this.unit}]`;
    return this.negate ? `(-${filter})` : filter;
  }
}

/**
 * Custom filter for providing raw RediSearch query syntax.
 *
 * This filter allows you to provide a custom RediSearch query string that will be used
 * as-is without any modification. This is useful when you need to use advanced RediSearch
 * features that are not covered by the other filter types, or when you want complete
 * control over the query syntax.
 *
 * **Warning**: When using custom filters, you are responsible for ensuring the query
 * syntax is valid RediSearch syntax. Invalid syntax will cause search queries to fail.
 *
 * @see https://redis.io/docs/stack/search/reference/query_syntax/
 *
 * @example
 * ```typescript
 * // Simple custom filter
 * const filter = new CustomFilter("@category:{electronics}");
 *
 * // Complex custom filter with multiple conditions
 * const filter = new CustomFilter("(@category:{electronics} @price:[0 100])");
 *
 * // Using advanced RediSearch features
 * const filter = new CustomFilter("@title:(wireless|bluetooth) @price:[50 200]");
 *
 * // Combining with other filters
 * const filter = new CustomFilter("@category:{electronics}")
 *   .and(Num("price").lt(100));
 *
 * // Using the convenience function
 * const filter = Custom("(@brand:{Apple} @year:[2020 +inf])");
 * ```
 */
export class CustomFilter extends FilterExpression {
  readonly filterType = "custom" as const;

  constructor(private query: string) {
    super();
  }

  toString(): string {
    return this.query;
  }
}

/**
 * Timestamp filter for date/time-based searches.
 *
 * **Important**: In Redis, there is no separate "timestamp" field type. Timestamps are stored
 * as NUMERIC fields containing Unix epoch timestamps (seconds since Jan 1, 1970 UTC).
 *
 * This filter class is a convenience wrapper that:
 * - Automatically converts JavaScript Date objects to Unix epoch timestamps
 * - Provides a fluent API for date/time comparisons
 * - Generates the correct numeric range queries for Redis
 *
 * When defining your metadata schema, use `type: "numeric"` for timestamp fields:
 * ```typescript
 * const schema: MetadataFieldSchema[] = [
 *   { name: "created_at", type: "numeric", options: { sortable: true } }
 * ];
 * ```
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/field-and-type-options/#numeric-fields
 *
 * @example
 * ```typescript
 * // Filter by exact date
 * const filter = new TimestampFilter("created_at", "eq", new Date("2023-01-01"));
 * // Generates: @created_at:[1672531200 1672531200]
 *
 * // Filter for dates after a specific time
 * const filter = new TimestampFilter("created_at", "gt", new Date("2023-06-01"));
 * // Generates: @created_at:[(1685577600 +inf]
 *
 * // Filter for dates in a range
 * const filter = new TimestampFilter(
 *   "created_at",
 *   "between",
 *   [new Date("2023-01-01"), new Date("2023-12-31")]
 * );
 * // Generates: @created_at:[1672531200 1703980800]
 *
 * // Using epoch timestamps directly
 * const filter = new TimestampFilter("updated_at", "gte", 1672531200);
 *
 * // Using convenience methods
 * const filter = Timestamp("created_at").gt(new Date("2023-01-01"));
 * const filter2 = Timestamp("updated_at").between(
 *   new Date("2023-01-01"),
 *   new Date("2023-12-31")
 * );
 * ```
 */
export class TimestampFilter extends FilterExpression {
  readonly filterType = "timestamp" as const;

  constructor(
    private field: string,
    private operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "between",
    private value: Date | number | [Date | number, Date | number],
    private negate: boolean = false
  ) {
    super();
  }

  /**
   * Creates a builder object for constructing timestamp filters.
   *
   * @param field - The name of the timestamp field to filter on
   * @returns An object with comparison methods (eq, ne, gt, gte, lt, lte, between)
   */
  static create(field: string) {
    return {
      eq: (value: Date | number) => new TimestampFilter(field, "eq", value),
      ne: (value: Date | number) => new TimestampFilter(field, "ne", value),
      gt: (value: Date | number) => new TimestampFilter(field, "gt", value),
      gte: (value: Date | number) => new TimestampFilter(field, "gte", value),
      lt: (value: Date | number) => new TimestampFilter(field, "lt", value),
      lte: (value: Date | number) => new TimestampFilter(field, "lte", value),
      between: (start: Date | number, end: Date | number) =>
        new TimestampFilter(field, "between", [start, end]),
    };
  }

  /**
   * Converts a Date object or number to Unix epoch timestamp (seconds).
   *
   * @param value - Date object or epoch timestamp
   * @returns Unix epoch timestamp in seconds
   */
  private toEpoch(value: Date | number): number {
    return typeof value === "object" && value && "getTime" in value
      ? Math.floor(value.getTime() / 1000)
      : (value as number);
  }

  toString(): string {
    let rangeStr: string;

    switch (this.operator) {
      case "eq": {
        const eqValue = this.toEpoch(this.value as Date | number);
        rangeStr = `[${eqValue} ${eqValue}]`;
        break;
      }
      case "ne": {
        const neValue = this.toEpoch(this.value as Date | number);
        return `(-@${this.field}:[${neValue} ${neValue}])`;
      }
      case "gt": {
        const gtValue = this.toEpoch(this.value as Date | number);
        rangeStr = `[(${gtValue} +inf]`;
        break;
      }
      case "gte": {
        const gteValue = this.toEpoch(this.value as Date | number);
        rangeStr = `[${gteValue} +inf]`;
        break;
      }
      case "lt": {
        const ltValue = this.toEpoch(this.value as Date | number);
        rangeStr = `[-inf (${ltValue}]`;
        break;
      }
      case "lte": {
        const lteValue = this.toEpoch(this.value as Date | number);
        rangeStr = `[-inf ${lteValue}]`;
        break;
      }
      case "between": {
        if (Array.isArray(this.value)) {
          const startValue = this.toEpoch(this.value[0]);
          const endValue = this.toEpoch(this.value[1]);
          rangeStr = `[${startValue} ${endValue}]`;
        } else {
          throw new Error("Between operator requires array of two values");
        }
        break;
      }
      default:
        throw new Error(`Unknown timestamp operator: ${this.operator}`);
    }

    const filter = `@${this.field}:${rangeStr}`;
    return this.negate ? `(-${filter})` : filter;
  }
}

// Convenience functions for creating filters (similar to Python RedisVL)

/**
 * Create a tag filter for exact matching on tag fields.
 *
 * This is a convenience function that provides a fluent API for building tag filters.
 * Tag filters are used for exact-match categorical filtering.
 *
 * @param field - The name of the tag field to filter on
 * @returns An object with `eq` and `ne` methods for creating tag filters
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/advanced-concepts/tags/
 *
 * @example
 * ```typescript
 * // Single value match
 * const filter = Tag("category").eq("electronics");
 *
 * // Multiple values (OR logic)
 * const filter = Tag("category").eq(["electronics", "books"]);
 *
 * // Negation
 * const filter = Tag("status").ne("archived");
 *
 * // Combine with other filters
 * const complexFilter = Tag("category").eq("electronics")
 *   .and(Num("price").lt(100));
 * ```
 */
export function Tag(field: string) {
  return TagFilter.create(field);
}

/**
 * Create a numeric filter for range and exact matching on numeric fields.
 *
 * This is a convenience function that provides a fluent API for building numeric filters.
 * Numeric filters support range queries and exact matching on numerical values.
 *
 * @param field - The name of the numeric field to filter on
 * @returns An object with comparison methods (eq, ne, gt, gte, lt, lte, between)
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/exact-match/#numeric-field
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/range/
 *
 * @example
 * ```typescript
 * // Exact match
 * const filter = Num("price").eq(99.99);
 *
 * // Range queries
 * const filter = Num("price").between(50, 200);
 * const filter2 = Num("rating").gte(4.5);
 * const filter3 = Num("stock").gt(0);
 *
 * // Combine with other filters
 * const complexFilter = Num("price").between(50, 200)
 *   .and(Tag("category").eq("electronics"));
 * ```
 */
export function Num(field: string) {
  return NumericFilter.create(field);
}

/**
 * Create a text filter for full-text search on text fields.
 *
 * This is a convenience function that provides a fluent API for building text filters.
 * Text filters support exact phrases, wildcard patterns, fuzzy matching, and tokenized search.
 *
 * @param field - The name of the text field to filter on
 * @returns An object with text search methods (eq, ne, match, wildcard, fuzzy)
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/full-text/
 *
 * @example
 * ```typescript
 * // Exact phrase
 * const filter = Text("title").eq("wireless headphones");
 *
 * // Wildcard search
 * const filter = Text("title").wildcard("*phone*");
 *
 * // Fuzzy search (tolerates typos)
 * const filter = Text("description").fuzzy("blutooth");
 *
 * // Tokenized word matching
 * const filter = Text("description").match("wireless bluetooth");
 * ```
 */
export function Text(field: string) {
  return TextFilter.create(field);
}

/**
 * Create a geographic filter for location-based searches.
 *
 * This is a convenience function that provides a fluent API for building geo filters.
 * Geo filters support radius-based geographic queries using longitude/latitude coordinates.
 *
 * @param field - The name of the geo field to filter on
 * @returns An object with `within` and `outside` methods for creating geo filters
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/geo-spatial/
 *
 * @example
 * ```typescript
 * // Find locations within radius
 * const filter = Geo("location").within(-122.4194, 37.7749, 10, "km");
 *
 * // Find locations outside radius
 * const filter = Geo("location").outside(-74.0060, 40.7128, 50, "mi");
 *
 * // Combine with other filters
 * const complexFilter = Geo("store_location").within(-122.4194, 37.7749, 5, "km")
 *   .and(Tag("store_type").eq("retail"));
 * ```
 */
export function Geo(field: string) {
  return GeoFilter.create(field);
}

/**
 * Create a timestamp filter for date/time-based searches.
 *
 * This is a convenience function that provides a fluent API for building timestamp filters.
 * Timestamp filters work with Date objects or Unix epoch timestamps and support range queries.
 *
 * **Important**: Timestamps are stored as NUMERIC fields in Redis (Unix epoch timestamps).
 * When defining your schema, use `type: "numeric"` for timestamp fields.
 *
 * @param field - The name of the numeric field containing timestamp data
 * @returns An object with comparison methods (eq, ne, gt, gte, lt, lte, between)
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/indexing/field-and-type-options/#numeric-fields
 *
 * @example
 * ```typescript
 * // Define schema with numeric type for timestamps
 * const schema: MetadataFieldSchema[] = [
 *   { name: "created_at", type: "numeric", options: { sortable: true } }
 * ];
 *
 * // Filter by date
 * const filter = Timestamp("created_at").gt(new Date("2023-01-01"));
 *
 * // Date range
 * const filter = Timestamp("created_at").between(
 *   new Date("2023-01-01"),
 *   new Date("2023-12-31")
 * );
 *
 * // Using epoch timestamps
 * const filter = Timestamp("updated_at").gte(1672531200);
 *
 * // Combine with other filters
 * const complexFilter = Timestamp("created_at").gt(new Date("2023-01-01"))
 *   .and(Tag("status").eq("published"));
 * ```
 */
export function Timestamp(field: string) {
  return TimestampFilter.create(field);
}

/**
 * Create a custom filter with raw RediSearch query syntax.
 *
 * This is a convenience function for creating custom filters that use raw RediSearch
 * query syntax. The provided query string will be used as-is without any modification.
 *
 * Use this when you need advanced RediSearch features not covered by the other filter
 * types, or when you want complete control over the query syntax.
 *
 * **Warning**: You are responsible for ensuring the query syntax is valid RediSearch syntax.
 *
 * @param query - The raw RediSearch query string
 * @returns A CustomFilter instance
 *
 * @see https://redis.io/docs/latest/develop/ai/search-and-query/query/
 *
 * @example
 * ```typescript
 * // Simple custom query
 * const filter = Custom("@category:{electronics}");
 *
 * // Complex query with multiple conditions
 * const filter = Custom("(@category:{electronics} @price:[0 100])");
 *
 * // Advanced RediSearch features
 * const filter = Custom("@title:(wireless|bluetooth) @price:[50 200]");
 *
 * // Combine with other filters
 * const complexFilter = Custom("@category:{electronics}")
 *   .and(Num("price").lt(100));
 * ```
 */
export function Custom(query: string): CustomFilter {
  return new CustomFilter(query);
}
