/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import {
  FilterExpression,
  AndFilter,
  OrFilter,
  TagFilter,
  NumericFilter,
  TextFilter,
  GeoFilter,
  TimestampFilter,
  CustomFilter,
  Tag,
  Num,
  Text,
  Geo,
  Timestamp,
  Custom,
} from "../filters.js";

describe("TagFilter", () => {
  test("creates correct query string for single value", () => {
    const filter = new TagFilter("category", "electronics");
    expect(filter.toString()).toBe("@category:{electronics}");
    expect(filter.filterType).toBe("tag");
  });

  test("creates correct query string for array values", () => {
    const filter = new TagFilter("category", ["electronics", "books"]);
    expect(filter.toString()).toBe("@category:{electronics|books}");
  });

  test("creates correct query string for Set values", () => {
    const filter = new TagFilter("category", new Set(["electronics", "books"]));
    expect(filter.toString()).toBe("@category:{electronics|books}");
  });

  test("creates correct query string for negation", () => {
    const filter = new TagFilter("category", "electronics", true);
    expect(filter.toString()).toBe("(-@category:{electronics})");
  });

  test("returns wildcard for empty array", () => {
    const filter = new TagFilter("category", []);
    expect(filter.toString()).toBe("*");
  });

  test("returns wildcard for empty Set", () => {
    const filter = new TagFilter("category", new Set());
    expect(filter.toString()).toBe("*");
  });

  test("Tag convenience function works", () => {
    const filter = Tag("category").eq("electronics");
    expect(filter.toString()).toBe("@category:{electronics}");
    expect(filter).toBeInstanceOf(TagFilter);
  });

  test("Tag convenience function with ne works", () => {
    const filter = Tag("category").ne("archived");
    expect(filter.toString()).toBe("(-@category:{archived})");
  });
});

describe("NumericFilter", () => {
  test("creates correct query string for eq", () => {
    const filter = new NumericFilter("price", "eq", 100);
    expect(filter.toString()).toBe("@price:[100 100]");
    expect(filter.filterType).toBe("numeric");
  });

  test("creates correct query string for ne", () => {
    const filter = new NumericFilter("price", "ne", 100);
    expect(filter.toString()).toBe("(-@price:[100 100])");
  });

  test("creates correct query string for gt", () => {
    const filter = new NumericFilter("price", "gt", 50);
    expect(filter.toString()).toBe("@price:[(50 +inf]");
  });

  test("creates correct query string for gte", () => {
    const filter = new NumericFilter("price", "gte", 50);
    expect(filter.toString()).toBe("@price:[50 +inf]");
  });

  test("creates correct query string for lt", () => {
    const filter = new NumericFilter("price", "lt", 200);
    expect(filter.toString()).toBe("@price:[-inf (200]");
  });

  test("creates correct query string for lte", () => {
    const filter = new NumericFilter("price", "lte", 200);
    expect(filter.toString()).toBe("@price:[-inf 200]");
  });

  test("creates correct query string for between", () => {
    const filter = new NumericFilter("price", "between", [50, 200]);
    expect(filter.toString()).toBe("@price:[50 200]");
  });

  test("throws error for between without array", () => {
    const filter = new NumericFilter("price", "between", 100 as any);
    expect(() => filter.toString()).toThrow(
      "Between operator requires array of two numbers"
    );
  });

  test("Num convenience function works", () => {
    const eqFilter = Num("price").eq(100);
    expect(eqFilter.toString()).toBe("@price:[100 100]");
    expect(eqFilter).toBeInstanceOf(NumericFilter);

    const betweenFilter = Num("price").between(50, 200);
    expect(betweenFilter.toString()).toBe("@price:[50 200]");
  });
});

describe("TextFilter", () => {
  test("creates correct query string for exact match", () => {
    const filter = new TextFilter("title", "wireless headphones", "exact");
    expect(filter.toString()).toBe('@title:("wireless headphones")');
    expect(filter.filterType).toBe("text");
  });

  test("creates correct query string for match", () => {
    const filter = new TextFilter("title", "wireless bluetooth", "match");
    expect(filter.toString()).toBe("@title:(wireless bluetooth)");
  });

  test("creates correct query string for wildcard", () => {
    const filter = new TextFilter("title", "head*", "wildcard");
    expect(filter.toString()).toBe("@title:(head*)");
  });

  test("creates correct query string for fuzzy", () => {
    const filter = new TextFilter("title", "headphone", "fuzzy");
    expect(filter.toString()).toBe("@title:(%%headphone%%)");
  });

  test("creates correct query string for negation", () => {
    const filter = new TextFilter("title", "laptop", "exact", true);
    expect(filter.toString()).toBe('(-@title:("laptop"))');
  });

  test("returns wildcard for empty query", () => {
    const filter = new TextFilter("title", "", "exact");
    expect(filter.toString()).toBe("*");
  });

  test("returns wildcard for whitespace-only query", () => {
    const filter = new TextFilter("title", "   ", "exact");
    expect(filter.toString()).toBe("*");
  });

  test("Text convenience function works", () => {
    const exactFilter = Text("title").eq("wireless headphones");
    expect(exactFilter.toString()).toBe('@title:("wireless headphones")');
    expect(exactFilter).toBeInstanceOf(TextFilter);

    const wildcardFilter = Text("title").wildcard("*phone*");
    expect(wildcardFilter.toString()).toBe("@title:(*phone*)");

    const fuzzyFilter = Text("description").fuzzy("blutooth");
    expect(fuzzyFilter.toString()).toBe("@description:(%%blutooth%%)");

    const neFilter = Text("title").ne("archived");
    expect(neFilter.toString()).toBe('(-@title:("archived"))');
  });
});

describe("GeoFilter", () => {
  test("creates correct query string for within", () => {
    const filter = new GeoFilter("location", -122.4194, 37.7749, 10, "km");
    expect(filter.toString()).toBe("@location:[-122.4194 37.7749 10 km]");
    expect(filter.filterType).toBe("geo");
  });

  test("creates correct query string for different units", () => {
    const kmFilter = new GeoFilter("location", -122.4194, 37.7749, 10, "km");
    expect(kmFilter.toString()).toBe("@location:[-122.4194 37.7749 10 km]");

    const miFilter = new GeoFilter("location", -122.4194, 37.7749, 5, "mi");
    expect(miFilter.toString()).toBe("@location:[-122.4194 37.7749 5 mi]");

    const mFilter = new GeoFilter("location", -122.4194, 37.7749, 1000, "m");
    expect(mFilter.toString()).toBe("@location:[-122.4194 37.7749 1000 m]");

    const ftFilter = new GeoFilter("location", -122.4194, 37.7749, 5000, "ft");
    expect(ftFilter.toString()).toBe("@location:[-122.4194 37.7749 5000 ft]");
  });

  test("creates correct query string for outside (negation)", () => {
    const filter = new GeoFilter(
      "location",
      -122.4194,
      37.7749,
      10,
      "km",
      true
    );
    expect(filter.toString()).toBe("(-@location:[-122.4194 37.7749 10 km])");
  });

  test("Geo convenience function works", () => {
    const withinFilter = Geo("location").within(-122.4194, 37.7749, 10, "km");
    expect(withinFilter.toString()).toBe("@location:[-122.4194 37.7749 10 km]");
    expect(withinFilter).toBeInstanceOf(GeoFilter);

    const outsideFilter = Geo("location").outside(-74.006, 40.7128, 50, "mi");
    expect(outsideFilter.toString()).toBe(
      "(-@location:[-74.006 40.7128 50 mi])"
    );
  });
});

describe("TimestampFilter", () => {
  const testDate = new Date("2023-01-01T00:00:00Z");
  const testEpoch = Math.floor(testDate.getTime() / 1000);

  test("creates correct query string for eq with Date", () => {
    const filter = new TimestampFilter("created_at", "eq", testDate);
    expect(filter.toString()).toBe(`@created_at:[${testEpoch} ${testEpoch}]`);
    expect(filter.filterType).toBe("timestamp");
  });

  test("creates correct query string for eq with epoch", () => {
    const filter = new TimestampFilter("created_at", "eq", testEpoch);
    expect(filter.toString()).toBe(`@created_at:[${testEpoch} ${testEpoch}]`);
  });

  test("creates correct query string for ne", () => {
    const filter = new TimestampFilter("created_at", "ne", testDate);
    expect(filter.toString()).toBe(
      `(-@created_at:[${testEpoch} ${testEpoch}])`
    );
  });

  test("creates correct query string for gt", () => {
    const filter = new TimestampFilter("created_at", "gt", testDate);
    expect(filter.toString()).toBe(`@created_at:[(${testEpoch} +inf]`);
  });

  test("creates correct query string for gte", () => {
    const filter = new TimestampFilter("created_at", "gte", testDate);
    expect(filter.toString()).toBe(`@created_at:[${testEpoch} +inf]`);
  });

  test("creates correct query string for lt", () => {
    const filter = new TimestampFilter("created_at", "lt", testDate);
    expect(filter.toString()).toBe(`@created_at:[-inf (${testEpoch}]`);
  });

  test("creates correct query string for lte", () => {
    const filter = new TimestampFilter("created_at", "lte", testDate);
    expect(filter.toString()).toBe(`@created_at:[-inf ${testEpoch}]`);
  });

  test("creates correct query string for between with Dates", () => {
    const endDate = new Date("2023-12-31T23:59:59Z");
    const endEpoch = Math.floor(endDate.getTime() / 1000);
    const filter = new TimestampFilter("created_at", "between", [
      testDate,
      endDate,
    ]);
    expect(filter.toString()).toBe(`@created_at:[${testEpoch} ${endEpoch}]`);
  });

  test("creates correct query string for between with epochs", () => {
    const endEpoch = 1703980799;
    const filter = new TimestampFilter("created_at", "between", [
      testEpoch,
      endEpoch,
    ]);
    expect(filter.toString()).toBe(`@created_at:[${testEpoch} ${endEpoch}]`);
  });

  test("throws error for between without array", () => {
    const filter = new TimestampFilter(
      "created_at",
      "between",
      testDate as any
    );
    expect(() => filter.toString()).toThrow(
      "Between operator requires array of two values"
    );
  });

  test("Timestamp convenience function works", () => {
    const gtFilter = Timestamp("created_at").gt(testDate);
    expect(gtFilter.toString()).toBe(`@created_at:[(${testEpoch} +inf]`);
    expect(gtFilter).toBeInstanceOf(TimestampFilter);

    const betweenFilter = Timestamp("created_at").between(
      testDate,
      new Date("2023-12-31")
    );
    expect(betweenFilter).toBeInstanceOf(TimestampFilter);
  });
});

describe("CustomFilter", () => {
  test("returns query string unmodified", () => {
    const filter = new CustomFilter("@category:{electronics}");
    expect(filter.toString()).toBe("@category:{electronics}");
    expect(filter.filterType).toBe("custom");
  });

  test("handles complex custom query", () => {
    const filter = new CustomFilter("(@category:{electronics} @price:[0 100])");
    expect(filter.toString()).toBe("(@category:{electronics} @price:[0 100])");
  });

  test("handles advanced RediSearch syntax", () => {
    const filter = new CustomFilter(
      "@title:(wireless|bluetooth) @price:[50 200]"
    );
    expect(filter.toString()).toBe(
      "@title:(wireless|bluetooth) @price:[50 200]"
    );
  });

  test("handles empty string", () => {
    const filter = new CustomFilter("");
    expect(filter.toString()).toBe("");
  });

  test("handles wildcard", () => {
    const filter = new CustomFilter("*");
    expect(filter.toString()).toBe("*");
  });

  test("Custom convenience function works", () => {
    const filter = Custom("@brand:{Apple}");
    expect(filter.toString()).toBe("@brand:{Apple}");
    expect(filter).toBeInstanceOf(CustomFilter);
  });

  test("can be combined with other filters using and()", () => {
    const customFilter = Custom("@category:{electronics}");
    const priceFilter = Num("price").lt(100);
    const combined = customFilter.and(priceFilter);

    expect(combined).toBeInstanceOf(AndFilter);
    expect(combined.toString()).toBe(
      "(@category:{electronics} @price:[-inf (100])"
    );
  });

  test("can be combined with other filters using or()", () => {
    const customFilter = Custom("@category:{electronics}");
    const tagFilter = Tag("brand").eq("Apple");
    const combined = customFilter.or(tagFilter);

    expect(combined).toBeInstanceOf(OrFilter);
    expect(combined.toString()).toBe(
      "(@category:{electronics}|@brand:{Apple})"
    );
  });

  test("can be used in complex combinations", () => {
    const customFilter = Custom("(@brand:{Apple} @year:[2020 +inf])");
    const priceFilter = Num("price").between(500, 2000);
    const combined = customFilter.and(priceFilter);

    expect(combined.toString()).toBe(
      "((@brand:{Apple} @year:[2020 +inf]) @price:[500 2000])"
    );
  });
});

describe("AndFilter", () => {
  test("creates correct query string for AND combination", () => {
    const tagFilter = new TagFilter("category", "electronics");
    const priceFilter = new NumericFilter("price", "lt", 100);
    const andFilter = new AndFilter([tagFilter, priceFilter]);

    expect(andFilter.toString()).toBe(
      "(@category:{electronics} @price:[-inf (100])"
    );
    expect(andFilter.filterType).toBe("and");
  });

  test("handles wildcard on left side", () => {
    const wildcardFilter = new TagFilter("empty", []);
    const priceFilter = new NumericFilter("price", "lt", 100);
    const andFilter = new AndFilter([wildcardFilter, priceFilter]);

    expect(andFilter.toString()).toBe("@price:[-inf (100]");
  });

  test("handles wildcard on right side", () => {
    const tagFilter = new TagFilter("category", "electronics");
    const wildcardFilter = new TagFilter("empty", []);
    const andFilter = new AndFilter([tagFilter, wildcardFilter]);

    expect(andFilter.toString()).toBe("@category:{electronics}");
  });

  test("and() method works on FilterExpression", () => {
    const tagFilter = Tag("category").eq("electronics");
    const priceFilter = Num("price").lt(100);
    const combined = tagFilter.and(priceFilter);

    expect(combined).toBeInstanceOf(AndFilter);
    expect(combined.toString()).toBe(
      "(@category:{electronics} @price:[-inf (100])"
    );
  });

  test("chaining multiple and() calls works", () => {
    const filter1 = Tag("category").eq("electronics");
    const filter2 = Num("price").lt(100);
    const filter3 = Num("rating").gte(4);
    const combined = filter1.and(filter2).and(filter3);

    expect(combined.toString()).toBe(
      "((@category:{electronics} @price:[-inf (100]) @rating:[4 +inf])"
    );
  });
});

describe("OrFilter", () => {
  test("creates correct query string for OR combination", () => {
    const tagFilter = new TagFilter("category", "electronics");
    const priceFilter = new NumericFilter("price", "gt", 500);
    const orFilter = new OrFilter([tagFilter, priceFilter]);

    expect(orFilter.toString()).toBe(
      "(@category:{electronics}|@price:[(500 +inf])"
    );
    expect(orFilter.filterType).toBe("or");
  });

  test("handles wildcard on left side", () => {
    const wildcardFilter = new TagFilter("empty", []);
    const priceFilter = new NumericFilter("price", "lt", 100);
    const orFilter = new OrFilter([wildcardFilter, priceFilter]);

    expect(orFilter.toString()).toBe("*");
  });

  test("handles wildcard on right side", () => {
    const tagFilter = new TagFilter("category", "electronics");
    const wildcardFilter = new TagFilter("empty", []);
    const orFilter = new OrFilter([tagFilter, wildcardFilter]);

    expect(orFilter.toString()).toBe("*");
  });

  test("or() method works on FilterExpression", () => {
    const tagFilter = Tag("category").eq("electronics");
    const priceFilter = Num("price").gt(500);
    const combined = tagFilter.or(priceFilter);

    expect(combined).toBeInstanceOf(OrFilter);
    expect(combined.toString()).toBe(
      "(@category:{electronics}|@price:[(500 +inf])"
    );
  });

  test("chaining multiple or() calls works", () => {
    const filter1 = Tag("category").eq("electronics");
    const filter2 = Tag("category").eq("books");
    const filter3 = Tag("category").eq("clothing");
    const combined = filter1.or(filter2).or(filter3);

    expect(combined.toString()).toBe(
      "((@category:{electronics}|@category:{books})|@category:{clothing})"
    );
  });
});

describe("Complex Filter Combinations", () => {
  test("combines AND and OR filters", () => {
    const categoryFilter = Tag("category").eq("electronics");
    const priceFilter = Num("price").lt(100);
    const ratingFilter = Num("rating").gte(4);

    // (category=electronics AND price<100) OR rating>=4
    const combined = categoryFilter.and(priceFilter).or(ratingFilter);

    expect(combined.toString()).toBe(
      "((@category:{electronics} @price:[-inf (100])|@rating:[4 +inf])"
    );
  });

  test("combines all filter types", () => {
    const tagFilter = Tag("category").eq("electronics");
    const textFilter = Text("title").match("wireless");
    const numFilter = Num("price").between(50, 200);
    const geoFilter = Geo("location").within(-122.4194, 37.7749, 10, "km");
    const tsFilter = Timestamp("created_at").gt(new Date("2023-01-01"));

    const combined = tagFilter
      .and(textFilter)
      .and(numFilter)
      .and(geoFilter)
      .and(tsFilter);

    expect(combined).toBeInstanceOf(AndFilter);
    expect(combined.toString()).toContain("@category:{electronics}");
    expect(combined.toString()).toContain("@title:(wireless)");
    expect(combined.toString()).toContain("@price:[50 200]");
    expect(combined.toString()).toContain(
      "@location:[-122.4194 37.7749 10 km]"
    );
    expect(combined.toString()).toContain("@created_at:");
  });

  test("nested combinations work correctly", () => {
    // (category=electronics OR category=books) AND price<100
    const electronicsFilter = Tag("category").eq("electronics");
    const booksFilter = Tag("category").eq("books");
    const priceFilter = Num("price").lt(100);

    const categoryOr = electronicsFilter.or(booksFilter);
    const combined = categoryOr.and(priceFilter);

    expect(combined.toString()).toBe(
      "((@category:{electronics}|@category:{books}) @price:[-inf (100])"
    );
  });

  test("complex nested structure", () => {
    // ((category=electronics AND price<100) OR (category=books AND price<20)) AND rating>=4
    const electronics = Tag("category")
      .eq("electronics")
      .and(Num("price").lt(100));
    const books = Tag("category").eq("books").and(Num("price").lt(20));
    const rating = Num("rating").gte(4);

    const combined = electronics.or(books).and(rating);

    expect(combined.toString()).toContain("@category:{electronics}");
    expect(combined.toString()).toContain("@category:{books}");
    expect(combined.toString()).toContain("@rating:[4 +inf]");
  });
});

describe("FilterExpression base class", () => {
  test("all filter types extend FilterExpression", () => {
    const tagFilter = new TagFilter("category", "electronics");
    const numFilter = new NumericFilter("price", "eq", 100);
    const textFilter = new TextFilter("title", "laptop", "exact");
    const geoFilter = new GeoFilter("location", -122.4194, 37.7749, 10, "km");
    const tsFilter = new TimestampFilter("created_at", "eq", new Date());
    const customFilter = new CustomFilter("@field:{value}");
    const andFilter = new AndFilter([tagFilter, numFilter]);
    const orFilter = new OrFilter([tagFilter, numFilter]);

    expect(tagFilter).toBeInstanceOf(FilterExpression);
    expect(numFilter).toBeInstanceOf(FilterExpression);
    expect(textFilter).toBeInstanceOf(FilterExpression);
    expect(geoFilter).toBeInstanceOf(FilterExpression);
    expect(tsFilter).toBeInstanceOf(FilterExpression);
    expect(customFilter).toBeInstanceOf(FilterExpression);
    expect(andFilter).toBeInstanceOf(FilterExpression);
    expect(orFilter).toBeInstanceOf(FilterExpression);
  });

  test("all filters have filterType property", () => {
    expect(new TagFilter("f", "v").filterType).toBe("tag");
    expect(new NumericFilter("f", "eq", 1).filterType).toBe("numeric");
    expect(new TextFilter("f", "v", "exact").filterType).toBe("text");
    expect(new GeoFilter("f", 0, 0, 1, "km").filterType).toBe("geo");
    expect(new TimestampFilter("f", "eq", new Date()).filterType).toBe(
      "timestamp"
    );
    expect(new CustomFilter("@f:{v}").filterType).toBe("custom");
    expect(
      new AndFilter([new TagFilter("f", "v"), new TagFilter("f2", "v2")])
        .filterType
    ).toBe("and");
    expect(
      new OrFilter([new TagFilter("f", "v"), new TagFilter("f2", "v2")])
        .filterType
    ).toBe("or");
  });
});
