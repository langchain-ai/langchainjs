import { faker } from "@faker-js/faker";
import {
  ADFNode,
  adfToText,
  JiraDocumentConverter,
  JiraIssue,
  JiraProjectLoader,
  JiraUser,
  JiraIssueType,
  JiraPriority,
  JiraProgress,
  JiraProject,
  JiraStatus,
  JiraStatusCategory,
} from "../web/jira.js";

describe("JiraDocumentConverter Unit Tests", () => {
  function getConverter() {
    return new JiraDocumentConverter({
      projectKey: "PROJ",
      host: "https://example.com",
    });
  }

  it("should handle missing optional fields", () => {
    const issue: JiraIssue = someJiraIssue();
    delete issue.fields.assignee;
    delete issue.fields.duedate;

    const converter = getConverter();
    const document = converter.convertToDocuments([issue])[0];

    expect(document).toBeDefined();
    expect(document.pageContent).toContain(issue.fields.summary);
    expect(document.pageContent).toContain("Assignee: Unassigned");
    expect(document.pageContent).not.toMatch(/.*^Due Date: .*/m);
    expect(document.metadata).toEqual({
      id: issue.id,
      host: converter.host,
      projectKey: converter.projectKey,
      created: issue.fields.created,
    });
  });

  it("should format the document content properly", () => {
    const converter = getConverter();
    const issue = someJiraIssue();
    const document = converter.convertToDocuments([issue])[0];

    expect(document.pageContent).toContain(issue.fields.summary);
    expect(document.pageContent).toContain(adfToText(issue.fields.description));
    expect(document.pageContent).toContain(
      issue.fields.labels?.join(", ") || ""
    );
    expect(document.pageContent).toContain(
      issue.fields.reporter?.displayName || ""
    );
    expect(document.pageContent).toContain(
      issue.fields.assignee?.displayName || "Unassigned"
    );
    expect(document.pageContent).toContain(issue.fields.duedate || "");
    expect(document.pageContent).toContain(
      issue.fields.timeestimate?.toString() || ""
    );
    expect(document.pageContent).toContain(
      issue.fields.timespent?.toString() || ""
    );
    expect(document.pageContent).toContain(issue.fields.resolutiondate || "");
    expect(document.pageContent).toContain(
      issue.fields.progress.percent?.toString() || ""
    );
  });

  it("should include subtasks and parent issue", () => {
    const converter = getConverter();
    const parentIssue = someJiraIssue({ key: "PROJ-0" });
    const subtask = someJiraIssue({ key: "PROJ-2" });
    const issue = someJiraIssue({
      fields: {
        ...someJiraIssue().fields,
        subtasks: [subtask],
        parent: parentIssue,
      },
    });

    const document = converter.convertToDocuments([issue])[0];
    expect(document.pageContent).toContain("Subtasks:");
    expect(document.pageContent).toContain(subtask.key);
    expect(document.pageContent).toContain("Parent Issue:");
    expect(document.pageContent).toContain(parentIssue.key);
  });

  it("should use custom description formatter", () => {
    const customFormatter = vi.fn(() => "CUSTOM DESC");
    const converter = new JiraDocumentConverter({
      projectKey: "PROJ",
      host: "https://example.com",
      formatter: customFormatter,
    });

    const issue = someJiraIssue();
    const document = converter.convertToDocuments([issue])[0];

    expect(customFormatter).toHaveBeenCalledWith(
      issue.fields.description,
      issue
    );
    expect(document.pageContent).toContain("CUSTOM DESC");
  });

  it("should handle empty or nested ADF descriptions", () => {
    const converter = getConverter();

    const emptyAdfIssue = someJiraIssue({
      fields: { ...someJiraIssue().fields, description: null },
    });
    const doc1 = converter.convertToDocuments([emptyAdfIssue])[0];

    expect(doc1.pageContent).toContain(emptyAdfIssue.fields.summary);
  });
});

describe("JiraProjectLoader", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(
    ...responses: Array<{ ok: boolean; status: number; body: unknown }>
  ) {
    const calls: { url: string; init: RequestInit }[] = [];
    let callIndex = 0;
    global.fetch = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: url.toString(), init: init ?? {} });
        const res = responses[callIndex] ?? responses[responses.length - 1];
        callIndex += 1;
        return {
          ok: res.ok,
          status: res.status,
          json: async () => res.body,
        } as Response;
      }
    );
    return calls;
  }

  function makeLoader(
    overrides: Partial<
      Parameters<typeof JiraProjectLoader.prototype.load>[0]
    > = {}
  ) {
    return new JiraProjectLoader({
      host: "https://jira.example.com",
      projectKey: "TEST",
      username: "user@example.com",
      accessToken: "test-token",
      ...overrides,
    });
  }

  it("should send POST request with correct format", async () => {
    const issue = someJiraIssue();
    const calls = mockFetch({
      ok: true,
      status: 200,
      body: { issues: [issue], isLast: true },
    });

    const loader = makeLoader();
    await loader.loadAsIssues();

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe("https://jira.example.com/rest/api/3/search/jql");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Accept: "application/json",
    });

    const body = JSON.parse(init.body as string);
    expect(body.jql).toContain("project = TEST");
    expect(body.fields).toEqual(["*all"]);
    expect(typeof body.maxResults).toBe("number");
  });

  it("should include createdAfter in JQL", async () => {
    const issue = someJiraIssue();
    const calls = mockFetch({
      ok: true,
      status: 200,
      body: { issues: [issue], isLast: true },
    });

    const loader = makeLoader({ createdAfter: new Date("2024-06-15") });
    await loader.loadAsIssues();

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.jql).toContain('created >= "2024-06-15"');
  });

  it("should paginate via nextPageToken", async () => {
    const page1Issue = someJiraIssue();
    const page2Issue = someJiraIssue();
    const calls = mockFetch(
      {
        ok: true,
        status: 200,
        body: {
          issues: [page1Issue],
          isLast: false,
          nextPageToken: "token-abc",
        },
      },
      {
        ok: true,
        status: 200,
        body: { issues: [page2Issue], isLast: true },
      }
    );

    const loader = makeLoader();
    const issues = await loader.loadAsIssues();

    expect(calls).toHaveLength(2);
    expect(issues).toHaveLength(2);

    // First request should not have nextPageToken
    const body1 = JSON.parse(calls[0].init.body as string);
    expect(body1.nextPageToken).toBeUndefined();

    // Second request should include nextPageToken
    const body2 = JSON.parse(calls[1].init.body as string);
    expect(body2.nextPageToken).toBe("token-abc");
  });

  it("should throw on non-ok response", async () => {
    mockFetch({
      ok: false,
      status: 401,
      body: { errorMessages: ["Unauthorized"] },
    });

    const loader = makeLoader();
    await expect(loader.loadAsIssues()).rejects.toThrow(
      /Jira API request failed with status 401/
    );
  });

  it("should throw when nextPageToken is missing but isLast is not true", async () => {
    mockFetch({
      ok: true,
      status: 200,
      body: { issues: [someJiraIssue()], isLast: false },
    });

    const loader = makeLoader();
    await expect(loader.loadAsIssues()).rejects.toThrow(
      "Expected nextPageToken but none returned"
    );
  });

  it("should propagate errors from load() instead of swallowing them", async () => {
    mockFetch({
      ok: false,
      status: 403,
      body: { errorMessages: ["Forbidden"] },
    });

    const loader = makeLoader();
    await expect(loader.load()).rejects.toThrow(
      /Jira API request failed with status 403/
    );
  });

  it("should use custom jql when provided", async () => {
    const issue = someJiraIssue();
    const calls = mockFetch({
      ok: true,
      status: 200,
      body: { issues: [issue], isLast: true },
    });

    const customJql =
      "project = AC AND sprint in openSprints() ORDER BY priority DESC";
    const loader = makeLoader({ jql: customJql });
    await loader.loadAsIssues();

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.jql).toBe(customJql);
  });

  it("should ignore createdAfter when custom jql is provided", async () => {
    const issue = someJiraIssue();
    const calls = mockFetch({
      ok: true,
      status: 200,
      body: { issues: [issue], isLast: true },
    });

    const customJql = 'project = AC AND status = "In Progress"';
    const loader = makeLoader({
      jql: customJql,
      createdAfter: new Date("2024-01-01"),
    });
    await loader.loadAsIssues();

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.jql).toBe(customJql);
    expect(body.jql).not.toContain("created >=");
  });

  it("should respect maxTotal and stop pagination early", async () => {
    const calls = mockFetch(
      {
        ok: true,
        status: 200,
        body: {
          issues: [someJiraIssue(), someJiraIssue(), someJiraIssue()],
          isLast: false,
          nextPageToken: "token-page2",
        },
      },
      {
        ok: true,
        status: 200,
        body: {
          issues: [someJiraIssue(), someJiraIssue(), someJiraIssue()],
          isLast: false,
          nextPageToken: "token-page3",
        },
      },
      {
        ok: true,
        status: 200,
        body: {
          issues: [someJiraIssue()],
          isLast: true,
        },
      }
    );

    const loader = makeLoader({ maxTotal: 5, limitPerRequest: 3 });
    const issues = await loader.loadAsIssues();

    // Should stop after 2 pages (3 + 3 = 6 >= maxTotal of 5)
    // and trim to exactly 5
    expect(issues).toHaveLength(5);
    // Should not fetch page 3
    expect(calls).toHaveLength(2);
  });

  it("should adjust page size when approaching maxTotal", async () => {
    const calls = mockFetch(
      {
        ok: true,
        status: 200,
        body: {
          issues: [someJiraIssue(), someJiraIssue(), someJiraIssue()],
          isLast: false,
          nextPageToken: "token-page2",
        },
      },
      {
        ok: true,
        status: 200,
        body: {
          issues: [someJiraIssue()],
          isLast: true,
        },
      }
    );

    const loader = makeLoader({ maxTotal: 4, limitPerRequest: 3 });
    await loader.loadAsIssues();

    // First request: page size = min(3, 4) = 3
    const body1 = JSON.parse(calls[0].init.body as string);
    expect(body1.maxResults).toBe(3);

    // Second request: page size = min(3, remaining=1) = 1
    const body2 = JSON.parse(calls[1].init.body as string);
    expect(body2.maxResults).toBe(1);
  });

  it("should fetch all issues when maxTotal is not set", async () => {
    mockFetch({
      ok: true,
      status: 200,
      body: {
        issues: [someJiraIssue(), someJiraIssue(), someJiraIssue()],
        isLast: true,
      },
    });

    const loader = makeLoader();
    const issues = await loader.loadAsIssues();

    // Without maxTotal, returns everything
    expect(issues).toHaveLength(3);
  });
});

export function someJiraIssueType(
  overrides: Partial<JiraIssueType> = {}
): JiraIssueType {
  const baseIssueType: JiraIssueType = {
    avatarId: faker.number.int({ min: 1, max: 100 }),
    description: faker.lorem.sentence(),
    entityId: faker.string.uuid(),
    hierarchyLevel: faker.number.int({ min: 1, max: 5 }),
    iconUrl: faker.image.url(),
    id: faker.string.numeric(5),
    name: faker.helpers.arrayElement(["Bug", "Task", "Story", "Epic"]),
    self: faker.internet.url(),
    subtask: false,
  };

  return {
    ...baseIssueType,
    ...overrides,
  };
}

export function someJiraUser(overrides: Partial<JiraUser> = {}): JiraUser {
  const baseUser = {
    accountId: faker.string.uuid(),
    accountType: "atlassian",
    active: true,
    avatarUrls: {
      "16x16": faker.image.avatar(),
      "24x24": faker.image.avatar(),
      "32x32": faker.image.avatar(),
      "48x48": faker.image.avatar(),
    },
    displayName: faker.person.fullName(),
    emailAddress: faker.internet.email(),
    self: faker.internet.url(),
    timeZone: faker.location.timeZone(),
  };

  return {
    ...baseUser,
    ...overrides,
  };
}

export function someJiraPriority(
  overrides: Partial<JiraPriority> = {}
): JiraPriority {
  const basePriority: JiraPriority = {
    iconUrl: faker.image.url(),
    id: faker.string.numeric(2),
    name: faker.helpers.arrayElement([
      "Highest",
      "High",
      "Medium",
      "Low",
      "Lowest",
    ]),
    self: faker.internet.url(),
  };

  return {
    ...basePriority,
    ...overrides,
  };
}

export function someJiraProgress(
  overrides: Partial<JiraProgress> = {}
): JiraProgress {
  const baseProgress: JiraProgress = {
    progress: faker.number.int({ min: 0, max: 100 }),
    total: 100,
    percent: faker.number.int({ min: 0, max: 100 }),
  };

  return {
    ...baseProgress,
    ...overrides,
  };
}

export function someJiraProject(
  overrides: Partial<JiraProject> = {}
): JiraProject {
  const baseProject: JiraProject = {
    avatarUrls: {
      "16x16": faker.image.avatar(),
      "24x24": faker.image.avatar(),
      "32x32": faker.image.avatar(),
      "48x48": faker.image.avatar(),
    },
    id: faker.string.numeric(5),
    key: faker.string.alpha(4).toUpperCase(),
    name: faker.company.name(),
    projectTypeKey: "software",
    self: faker.internet.url(),
    simplified: false,
  };

  return {
    ...baseProject,
    ...overrides,
  };
}

export function someJiraStatusCategory(
  overrides: Partial<JiraStatusCategory> = {}
): JiraStatusCategory {
  const baseStatusCategory: JiraStatusCategory = {
    self: faker.internet.url(),
    id: faker.number.int({ min: 1, max: 5 }),
    key: faker.helpers.arrayElement(["new", "indeterminate", "done"]),
    colorName: faker.helpers.arrayElement(["blue-gray", "yellow", "green"]),
    name: faker.helpers.arrayElement(["To Do", "In Progress", "Done"]),
  };

  return {
    ...baseStatusCategory,
    ...overrides,
  };
}

export function someJiraStatus(
  overrides: Partial<JiraStatus> = {}
): JiraStatus {
  const baseStatus: JiraStatus = {
    self: faker.internet.url(),
    description: faker.lorem.sentence(),
    iconUrl: faker.image.url(),
    name: faker.helpers.arrayElement([
      "To Do",
      "In Progress",
      "Done",
      "Blocked",
    ]),
    id: faker.string.numeric(2),
    statusCategory: someJiraStatusCategory(),
  };

  return {
    ...baseStatus,
    ...overrides,
  };
}

export function someJiraIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  const issueKey = `${faker.string.alpha(4).toUpperCase()}-${faker.number.int({
    min: 1,
    max: 9999,
  })}`;

  const baseIssue: JiraIssue = {
    expand: "renderedFields",
    id: faker.string.numeric(5),
    self: `https://${faker.internet.domainName()}/rest/api/3/issue/${issueKey}`,
    key: issueKey,
    fields: {
      assignee: faker.datatype.boolean() ? someJiraUser() : undefined,
      created: faker.date.past().toISOString(),
      description: someJiraIssueDescription(),
      issuelinks: [],
      issuetype: someJiraIssueType(),
      labels: faker.datatype.boolean()
        ? Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
            faker.word.noun()
          )
        : undefined,
      priority: someJiraPriority(),
      progress: someJiraProgress(),
      project: someJiraProject(),
      reporter: faker.datatype.boolean() ? someJiraUser() : undefined,
      creator: someJiraUser(),
      resolutiondate: faker.datatype.boolean()
        ? faker.date.recent().toISOString()
        : undefined,
      status: someJiraStatus(),
      subtasks: [],
      summary: faker.lorem.sentence(),
      timeestimate: faker.datatype.boolean()
        ? faker.number.int({ min: 1, max: 100 }) * 3600
        : undefined,
      timespent: faker.datatype.boolean()
        ? faker.number.int({ min: 1, max: 100 }) * 3600
        : undefined,
      updated: faker.date.recent().toISOString(),
      duedate: faker.datatype.boolean()
        ? faker.date.future().toISOString()
        : undefined,
    },
  };

  return {
    ...baseIssue,
    ...overrides,
  };
}

export function someJiraIssueDescription(text?: string): ADFNode {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: text ?? faker.lorem.paragraph(),
          },
        ],
      },
    ],
  };
}
