/**
 * NOTE: Env var should be set, and configured project should exist
 */
import { Document } from "@langchain/core/documents";
import { expect, test } from "@jest/globals";
import {
  JiraIssue,
  JiraProjectLoader,
  JiraProjectLoaderParams,
} from "../web/jira.js";

const TIMEOUT_MS = 30000;

describe("JiraProjectLoader Integration Tests", () => {
  const JIRA_HOST = requireEnvVar("JIRA_HOST");
  const JIRA_USERNAME = requireEnvVar("JIRA_USERNAME");
  const JIRA_ACCESS_TOKEN = requireEnvVar("JIRA_ACCESS_TOKEN");
  const JIRA_PROJECT_KEY = requireEnvVar("JIRA_PROJECT_KEY");
  const jiraConf: JiraProjectLoaderParams = {
    host: JIRA_HOST,
    projectKey: JIRA_PROJECT_KEY,
    username: JIRA_USERNAME,
    accessToken: JIRA_ACCESS_TOKEN,
    limitPerRequest: 20,
  };

  test(
    "should load Jira project issues as documents successfully",
    async () => {
      const docs = await loadJiraDocsUntil((docs) => docs.length > 0);

      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);

      if (docs.length < 1) {
        // Skip test if not enough issues available
        return;
      }
      const firstDoc = docs[0];

      // Check document structure
      expect(firstDoc).toHaveProperty("pageContent");
      expect(firstDoc).toHaveProperty("metadata");

      // Check metadata
      expect(firstDoc.metadata).toHaveProperty("id");
      expect(firstDoc.metadata).toHaveProperty("host", JIRA_HOST);
      expect(firstDoc.metadata).toHaveProperty("projectKey", JIRA_PROJECT_KEY);

      // Check pageContent contains essential Jira issue information
      const content = firstDoc.pageContent;
      expect(content).toContain("Issue:");
      expect(content).toContain("Project:");
      expect(content).toContain("Status:");
      expect(content).toContain("Priority:");
      expect(content).toContain("Type:");
      expect(content).toContain("Creator:");
    },
    TIMEOUT_MS
  );

  test(
    "should filter issues based on createdAfter date",
    async () => {
      // First load at least 2 issues with different creation dates (ignoring time)
      const baseIssues = await loadJiraIssuesUntil(
        haveTwoDifferentCreationDates
      );
      if (baseIssues.length < 2) {
        // Skip test if not enough issues available
        return;
      }

      // Create a map from date string without time to list of issues
      const dateToIssueMap = new Map<string, JiraIssue[]>();
      baseIssues.forEach((issue) => {
        const date = asStringWithoutTime(new Date(issue.fields.created));
        dateToIssueMap.set(
          date,
          (dateToIssueMap.get(date) ?? []).concat(issue)
        );
      });
      // Convert map to list of {date, issues}
      const issuesGroupedByDate = Array.from(
        dateToIssueMap,
        ([date, issues]) => ({ date, issues })
      );
      issuesGroupedByDate.sort((a, b) => a.date.localeCompare(b.date));

      // Pick middle date to split issues in two groups
      const middleIndex = Math.floor(issuesGroupedByDate.length / 2);
      const middleDate = new Date(issuesGroupedByDate[middleIndex].date);
      const issuesAfterMiddle = issuesGroupedByDate
        .slice(middleIndex)
        .flatMap(({ issues }) => issues);

      // Load issues created after middle date
      const loader = new JiraProjectLoader({
        ...jiraConf,
        createdAfter: middleDate,
      });

      const filteredDocs = await loader.load();

      // Verify we got the expected issues
      expect(filteredDocs.length).toBeGreaterThan(0);
      expect(filteredDocs.length).toBeLessThan(baseIssues.length);

      // Verify all returned issues are created after our cutoff date
      const middleDateTimestamp = middleDate.getTime();

      // Verify we got the same issues as in our original set
      const filteredIds = new Set(filteredDocs.map((d) => d.metadata.id));
      const expectedIds = new Set(issuesAfterMiddle.map((issue) => issue.id));
      expect(filteredIds).toEqual(expectedIds);
    },
    TIMEOUT_MS
  );

  test(
    "should apply filterFn to issues",
    async () => {
      // Filter function: only include issues whose summary includes "Bug"
      const filterFn = (issue: JiraIssue) =>
        issue.fields.summary.toLowerCase().includes("bug");

      const loader = new JiraProjectLoader({
        ...jiraConf,
        filterFn,
      });

      const docs = await loader.load();

      // Skip if no issues match (project may not have any "Bug" issues)
      if (docs.length === 0) return;

      // Ensure all returned issues pass the filterFn
      docs.forEach((doc) => {
        const line = doc.pageContent
          .split("\n")
          .find((l) => /^Issue: /.test(l));
        expect(line).toBeDefined();
        expect(line!.toLowerCase()).toContain("bug");
      });
    },
    TIMEOUT_MS
  );

  test("should handle invalid credentials", async () => {
    const loader = new JiraProjectLoader({
      ...jiraConf,
      username: "invalid_username",
      accessToken: "invalid_token",
    });

    const docs = await loader.load();
    expect(docs).toEqual([]);
  });

  test("should handle invalid project key", async () => {
    const loader = new JiraProjectLoader({
      ...jiraConf,
      projectKey: "INVALID_PROJECT_KEY",
    });

    const docs = await loader.load();
    expect(docs).toEqual([]);
  });

  test(
    "should paginate through all issues using nextPageToken",
    async () => {
      const loader = new JiraProjectLoader({
        ...jiraConf,
      });

      const issues = await loader.loadAsIssues();

      // Skip if project has fewer than 2 issues (pagination not meaningful)
      if (issues.length < 2) return;

      // Basic sanity checks
      expect(issues.length).toBeGreaterThan(1);
      expect(issues[0]).toHaveProperty("id");
      expect(issues[0]).toHaveProperty("fields");

      // Verify chronological order by creation date
      for (let i = 1; i < issues.length; i++) {
        const prev = new Date(issues[i - 1].fields.created).getTime();
        const curr = new Date(issues[i].fields.created).getTime();
        expect(prev).toBeLessThanOrEqual(curr);
      }

      // Ensure all issue IDs are unique (no duplicate pages)
      const ids = issues.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);

      // Optional: verify minimal content in each issue
      issues.forEach((issue) => {
        expect(issue.fields.summary).toBeDefined();
        expect(issue.fields.status).toBeDefined();
      });
    },
    TIMEOUT_MS
  );

  test(
    "should apply custom description formatter in loader",
    async () => {
      const loader = new JiraProjectLoader({
        ...jiraConf,
        descriptionFormatter: () => "FORMATTED_DESC",
      });

      const docs = await loader.load();
      if (docs.length === 0) return;

      expect(docs[0].pageContent).toContain("FORMATTED_DESC");
    },
    TIMEOUT_MS
  );

  function requireEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`environment variable "${name}" must be set`);
    }
    return value;
  }

  function asStringWithoutTime(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  function sameDate(a: Date, b: Date) {
    return asStringWithoutTime(a) === asStringWithoutTime(b);
  }

  function haveTwoDifferentCreationDates(issues: JiraIssue[]): boolean {
    return (
      issues.length >= 2 &&
      issues
        .slice(1)
        .some(
          (issue) =>
            !sameDate(
              new Date(issue.fields.created),
              new Date(issues[0].fields.created)
            )
        )
    );
  }

  async function loadJiraDocsUntil(predicate: (docs: Document[]) => boolean) {
    const load = (createdAfter: Date) =>
      new JiraProjectLoader({
        ...jiraConf,
        createdAfter,
      }).load();
    return loadUntil(load, predicate);
  }

  async function loadJiraIssuesUntil(
    predicate: (docs: JiraIssue[]) => boolean
  ) {
    const load = (createdAfter: Date) =>
      new JiraProjectLoader({
        ...jiraConf,
        createdAfter,
      }).loadAsIssues();
    return loadUntil(load, predicate);
  }

  async function loadUntil<T>(
    loadCreatedAfter: (date: Date) => Promise<T[]>,
    predicate: (loaded: T[]) => boolean
  ): Promise<T[]> {
    const now = new Date();
    let months = 1;
    const maxMonths = 120;

    let loaded: T[] = [];
    while (!predicate(loaded) && months < maxMonths) {
      const createdAfter = new Date(now);
      createdAfter.setDate(now.getDate() - months * 30);
      loaded = await loadCreatedAfter(createdAfter);
      months *= 1.2;
    }

    if (months >= maxMonths) {
      return [];
    }
    return loaded;
  }
});
