/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, describe, jest } from "@jest/globals";
import { SqlDatabase } from "../sql_db.js";

// Simple mock DataSource that implements the interface
const createMockDataSource = (queryMock?: jest.Mock) => ({
  query:
    queryMock ||
    jest.fn().mockResolvedValue([{ id: 1, name: "test" }] as never),
  initialize: jest.fn().mockResolvedValue(undefined as never),
  destroy: jest.fn().mockResolvedValue(undefined as never),
  isInitialized: true,
  options: {
    type: "sqlite" as const,
    database: ":memory:",
  },
});

describe("SqlDatabase Security Features - Unit Tests", () => {
  describe("Constructor and Configuration", () => {
    test("should initialize with default security settings", async () => {
      const mockDataSource = createMockDataSource();
      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
      });

      expect(db.enableSqlValidation).toBe(true);
      expect(db.maxQueryLength).toBe(10000);
      expect(db.allowedStatements).toEqual([
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "CREATE",
        "DROP",
        "ALTER",
      ]);
    });

    test("should accept custom security configuration", async () => {
      const mockDataSource = createMockDataSource();
      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: ["SELECT"],
        enableSqlValidation: false,
        maxQueryLength: 5000,
      });

      expect(db.enableSqlValidation).toBe(false);
      expect(db.maxQueryLength).toBe(5000);
      expect(db.allowedStatements).toEqual(["SELECT"]);
    });
  });

  describe("SQL Validation", () => {
    test("should allow valid SELECT queries when configured", async () => {
      const queryMock = jest
        .fn()
        .mockResolvedValue([{ id: 1, name: "test" }] as never);
      const mockDataSource = createMockDataSource(queryMock);

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: ["SELECT"],
      });

      await db.run("SELECT * FROM products");
      expect(queryMock).toHaveBeenCalledWith("SELECT * FROM products");
    });

    test("should block unauthorized statement types", async () => {
      const queryMock = jest.fn().mockResolvedValue([] as never);
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: ["SELECT"],
      });

      await expect(db.run("DELETE FROM products")).rejects.toThrow(
        "Only SELECT queries are allowed for security reasons"
      );
      await expect(db.run("UPDATE products SET price = 999")).rejects.toThrow(
        "Only SELECT queries are allowed for security reasons"
      );
      await expect(
        db.run("INSERT INTO products (name, price) VALUES ('test', 1)")
      ).rejects.toThrow("Only SELECT queries are allowed for security reasons");

      expect(queryMock).not.toHaveBeenCalled();
    });

    const maliciousQueries = [
      "SELECT * FROM users; DROP TABLE products;", // Multiple statements (injection)
      "SELECT * FROM users WHERE id = 1 OR 1=1", // OR injection
      "SELECT * FROM users WHERE name = 'Alice' OR '1'='1'", // String-based injection
      "SELECT * FROM users; DELETE FROM products;", // Multiple statements (injection)
      "SELECT * FROM users; --", // SQL comment injection
      "SELECT * FROM users /* comment */ UNION SELECT * FROM products", // Comment + UNION injection
      "SELECT * FROM users; EXEC xp_cmdshell('dir')", // Command execution injection
    ];
    test.each(maliciousQueries)(
      'should detect SQL injection patterns ("%s")',
      async (query) => {
        const queryMock = jest.fn();
        const mockDataSource = createMockDataSource();

        const db = await SqlDatabase.fromDataSourceParams({
          appDataSource: mockDataSource as any,
        });
        await expect(db.run(query)).rejects.toThrow();
        expect(queryMock).not.toHaveBeenCalled();
      }
    );

    const additionalIllegitimateQueries = [
      "SELECT * FROM users UNION SELECT * FROM products", // UNION injection
      "SELECT * FROM users; SHUTDOWN;", // Database shutdown
      "SELECT * FROM users; BACKUP DATABASE;", // Database backup
      "SELECT * FROM users; RESTORE DATABASE;", // Database restore
      "SELECT * FROM users; TRUNCATE TABLE products;", // TRUNCATE injection
      "SELECT * FROM users WHERE id = 1; EXEC sp_executesql 'DROP TABLE products'", // Stored procedure execution
      "SELECT * FROM users WHERE name = '' OR '1'='1' --", // Classic SQL injection with comment
      "SELECT * FROM users WHERE id = 1' UNION SELECT username, password FROM admin_users --", // Classic UNION injection
      "SELECT * FROM users; xp_cmdshell('rm -rf /')", // Command shell execution
    ];
    test.each(additionalIllegitimateQueries)(
      'should block advanced SQL injection attempts ("%s")',
      async (query) => {
        const queryMock = jest.fn();
        const mockDataSource = createMockDataSource();

        const db = await SqlDatabase.fromDataSourceParams({
          appDataSource: mockDataSource as any,
        });
        await expect(db.run(query)).rejects.toThrow();
        expect(queryMock).not.toHaveBeenCalled();
      }
    );

    // These should all be allowed since they're in the default allowed statements
    const legitimateQueries = [
      "SELECT * FROM users",
      "INSERT INTO users (name) VALUES ('test')",
      "UPDATE users SET name = 'updated'",
      "DELETE FROM old_table",
      "CREATE TABLE new_table (id INT)",
      "DROP TABLE old_table",
      "ALTER TABLE users ADD COLUMN email TEXT",
    ];
    test.each(legitimateQueries)(
      'should allow legitimate single statements from allowed list ("%s")',
      async (query) => {
        const queryMock = jest.fn().mockResolvedValue([] as never);
        const mockDataSource = createMockDataSource(queryMock);

        const db = await SqlDatabase.fromDataSourceParams({
          appDataSource: mockDataSource as any,
          // Using default allowed statements which include all major SQL operations for backward compatibility
        });

        await db.run(query);
        expect(queryMock).toHaveBeenCalledWith(query);
      }
    );

    test("should reject multiple statements", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
      });

      await expect(
        db.run("SELECT * FROM users; SELECT * FROM products;")
      ).rejects.toThrow("Multiple SQL statements are not allowed");
      expect(queryMock).not.toHaveBeenCalled();
    });

    test("should enforce maximum query length", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        maxQueryLength: 50,
      });

      const longQuery = `SELECT * FROM products WHERE ${"name = 'test' AND ".repeat(
        20
      )}id = 1`;
      await expect(db.run(longQuery)).rejects.toThrow(
        "SQL command exceeds maximum allowed length"
      );
      expect(queryMock).not.toHaveBeenCalled();
    });

    test("should validate query input types", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
      });

      // @ts-expect-error - Testing invalid input
      await expect(db.run(null)).rejects.toThrow(
        "SQL command must be a non-empty string"
      );
      await expect(db.run("")).rejects.toThrow(
        "SQL command must be a non-empty string"
      );
      // @ts-expect-error - Testing invalid input
      await expect(db.run(123)).rejects.toThrow(
        "SQL command must be a non-empty string"
      );

      expect(queryMock).not.toHaveBeenCalled();
    });

    test("should allow disabling SQL validation", async () => {
      const queryMock = jest.fn().mockResolvedValue([] as never);
      const mockDataSource = createMockDataSource(queryMock);

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        enableSqlValidation: false,
      });

      await db.run("SELECT * FROM products");
      expect(queryMock).toHaveBeenCalledWith("SELECT * FROM products");
    });
  });

  describe("Parameterized Queries", () => {
    test("should support parameterized queries with array parameters", async () => {
      const queryMock = jest.fn().mockResolvedValue([] as never);
      const mockDataSource = createMockDataSource(queryMock);

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: ["SELECT"],
      });

      await db.run("SELECT * FROM users WHERE age > ?", [20]);
      expect(queryMock).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE age > ?",
        [20]
      );
    });

    test("should support parameterized queries with multiple parameters", async () => {
      const queryMock = jest.fn().mockResolvedValue([] as never);
      const mockDataSource = createMockDataSource(queryMock);

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: ["SELECT"],
      });

      await db.run("SELECT * FROM users WHERE age >= ? AND name = ?", [
        20,
        "Alice",
      ]);
      expect(queryMock).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE age >= ? AND name = ?",
        [20, "Alice"]
      );
    });

    test("should validate parameterized queries for security", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: ["SELECT"],
      });

      // Even with parameters, injection attempts in the query string should be blocked
      await expect(
        db.run("SELECT * FROM users; DROP TABLE products", [1])
      ).rejects.toThrow();
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("Security Edge Cases", () => {
    const caseInsensitiveStatements = [
      "select * from users",
      "SELECT * FROM users",
      "   SELECT   * FROM users   ",
    ];
    test.each(caseInsensitiveStatements)(
      'should handle case-insensitive statement detection ("%s")',
      async (query) => {
        const queryMock = jest.fn().mockResolvedValue([] as never);
        const mockDataSource = createMockDataSource(queryMock);
        const db = await SqlDatabase.fromDataSourceParams({
          appDataSource: mockDataSource as any,
          allowedStatements: ["SELECT"],
        });

        await db.run(query);
        expect(queryMock).toHaveBeenCalledWith(query);
      }
    );

    const injectionPatterns = [
      "SELECT * FROM users; drop table products;", // Case insensitive injection
      "SELECT * FROM users; DROP TABLE products;", // Multiple statement injection
      "SELECT * FROM users; Delete FROM products;", // Mixed case injection
    ];
    test.each(injectionPatterns)(
      'should detect SQL injection patterns regardless of case ("%s")',
      async (query) => {
        const queryMock = jest.fn().mockResolvedValue([] as never);
        const mockDataSource = createMockDataSource();
        const db = await SqlDatabase.fromDataSourceParams({
          appDataSource: mockDataSource as any,
        });
        await expect(db.run(query)).rejects.toThrow();
        expect(queryMock).not.toHaveBeenCalled();
      }
    );

    const commentBasedInjectionAttempts = [
      "SELECT * FROM users -- DROP TABLE products",
      "SELECT * FROM users /* DROP TABLE products */",
      "SELECT * FROM users; /* hidden command */ DELETE FROM products; /* end */",
    ];
    test.each(commentBasedInjectionAttempts)(
      'should prevent comment-based injection attempts ("%s")',
      async (query) => {
        const queryMock = jest.fn().mockResolvedValue([] as never);
        const mockDataSource = createMockDataSource();
        const db = await SqlDatabase.fromDataSourceParams({
          appDataSource: mockDataSource as any,
        });

        await expect(db.run(query)).rejects.toThrow();
        expect(queryMock).not.toHaveBeenCalled();
      }
    );

    test("should handle encoding-based injection attempts", async () => {
      const queryMock = jest.fn().mockResolvedValue([] as never);
      const mockDataSource = createMockDataSource();
      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
      });

      await expect(
        db.run(
          "SELECT * FROM users WHERE id = 1\u003B DROP TABLE products\u003B"
        )
      ).rejects.toThrow();
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe("Advanced Security Tests", () => {
    test("should block time-based injection patterns with multiple statements", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
      });

      const timeBasedInjectionQueries = [
        "SELECT * FROM users WHERE id = 1; WAITFOR DELAY '00:00:10'; --", // Multiple statements - blocked
        "SELECT * FROM users WHERE id = 1; pg_sleep(10); --", // Multiple statements - blocked
      ];

      for (const query of timeBasedInjectionQueries) {
        await expect(db.run(query)).rejects.toThrow();
        expect(queryMock).not.toHaveBeenCalled();
      }
    });

    test("should block OR-based injection patterns", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
      });

      // These patterns are specifically detected by the validation
      const orInjectionQueries = [
        "SELECT * FROM users WHERE id = 1 OR 1=1",
        "SELECT * FROM users WHERE name = 'test' OR '1'='1'",
      ];

      for (const query of orInjectionQueries) {
        await expect(db.run(query)).rejects.toThrow();
        expect(queryMock).not.toHaveBeenCalled();
      }
    });

    test("should block stacked queries (multiple statements)", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
      });

      const stackedQueries = [
        "SELECT * FROM users; INSERT INTO logs VALUES ('hacked');",
        "SELECT name FROM users; UPDATE users SET admin = 1;",
        "SELECT id FROM products; DROP DATABASE test;",
      ];

      for (const query of stackedQueries) {
        // The validation will catch these as dangerous patterns, not specifically as "Multiple SQL statements"
        await expect(db.run(query)).rejects.toThrow();
        expect(queryMock).not.toHaveBeenCalled();
      }
    });
  });

  describe("Configuration Validation", () => {
    test("should accept valid allowed statements array", async () => {
      const mockDataSource = createMockDataSource();
      const customStatements = ["SELECT", "INSERT"];

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: customStatements,
      });

      expect(db.allowedStatements).toEqual(customStatements);
    });

    test("should handle empty allowed statements array", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        allowedStatements: [],
      });

      await expect(db.run("SELECT * FROM users")).rejects.toThrow(
        "Only  queries are allowed for security reasons"
      );
      expect(queryMock).not.toHaveBeenCalled();
    });

    test("should respect custom maxQueryLength", async () => {
      const queryMock = jest.fn();
      const mockDataSource = createMockDataSource();

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: mockDataSource as any,
        maxQueryLength: 20,
      });

      await expect(db.run("SELECT * FROM users WHERE id = 1")).rejects.toThrow(
        "SQL command exceeds maximum allowed length"
      );
      expect(queryMock).not.toHaveBeenCalled();
    });
  });
});
