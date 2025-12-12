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

  test("should load Jira project issues as documents successfully", async () => {
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
  });

  test("should filter issues based on createdAfter date", async () => {
    // First load at least 2 issues with different creation dates (ignoring time)
    const baseIssues = await loadJiraIssuesUntil(haveTwoDifferentCreationDates);
    if (baseIssues.length < 2) {
      // Skip test if not enough issues available
      return;
    }

    // Create a map from date string without time to list of issues
    const dateToIssueMap = new Map<string, JiraIssue[]>();
    baseIssues.forEach((issue) => {
      const date = asStringWithoutTime(new Date(issue.fields.created));
      dateToIssueMap.set(date, (dateToIssueMap.get(date) ?? []).concat(issue));
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
    filteredDocs.forEach((doc) => {
      const issueDateString = doc.pageContent
        .split("\n")
        .filter((line) => /^Created: /.test(line))[0]
        .replace("Created: ", "");
      const issueDateTimestamp = new Date(
        asStringWithoutTime(new Date(issueDateString))
      ).getTime();
      expect(issueDateTimestamp).toBeGreaterThanOrEqual(middleDateTimestamp);
    });

    // Verify we got the same issues as in our original set
    const filteredIds = new Set(filteredDocs.map((d) => d.metadata.id));
    const expectedIds = new Set(issuesAfterMiddle.map((issue) => issue.id));
    expect(filteredIds).toEqual(expectedIds);
  });

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
