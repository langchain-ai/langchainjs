/**
 * NOTE: Env var should be set, and configured project should exist
 */
import { expect, test } from "@jest/globals";
import { JiraProjectLoader } from "../web/jira.js";

describe("JiraProjectLoader Integration Tests", () => {
  const JIRA_HOST = requireEnvVar("JIRA_HOST");
  const JIRA_USERNAME = requireEnvVar("JIRA_USERNAME");
  const JIRA_ACCESS_TOKEN = requireEnvVar("JIRA_ACCESS_TOKEN");
  const JIRA_PROJECT_KEY = requireEnvVar("JIRA_PROJECT_KEY");

  function requireEnvVar(name: string): string {
    // eslint-disable-next-line no-process-env
    const value = process.env[name];
    if (!value) {
      throw new Error(`environment variable "${name}" must be set`);
    }
    return value;
  }

  test("should load Jira project issues successfully", async () => {
    const loader = new JiraProjectLoader({
      host: JIRA_HOST,
      projectKey: JIRA_PROJECT_KEY,
      username: JIRA_USERNAME,
      accessToken: JIRA_ACCESS_TOKEN,
      limitPerRequest: 20
    });

    const docs = await loader.load();

    expect(docs).toBeDefined();
    expect(Array.isArray(docs)).toBe(true);

    if (docs.length > 0) {
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
    }
  });

  test("should handle invalid credentials", async () => {
    const loader = new JiraProjectLoader({
      host: JIRA_HOST,
      projectKey: JIRA_PROJECT_KEY,
      username: "invalid_username",
      accessToken: "invalid_token"
    });

    const docs = await loader.load();
    expect(docs).toEqual([]);
  });

  test("should handle invalid project key", async () => {
    const loader = new JiraProjectLoader({
      host: JIRA_HOST,
      projectKey: "INVALID_PROJECT_KEY",
      username: JIRA_USERNAME,
      accessToken: JIRA_ACCESS_TOKEN
    });

    const docs = await loader.load();
    expect(docs).toEqual([]);
  });
});
