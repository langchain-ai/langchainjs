import { faker } from "@faker-js/faker";
import { JiraDocumentConverter, JiraIssue, JiraUser, JiraIssueType, JiraPriority, JiraProgress, JiraProject, JiraStatus, JiraStatusCategory } from "../web/jira.js";


describe("JiraDocumentConverter Unit Tests", () => {

  function getConverter() {
    return new JiraDocumentConverter({
      projectKey: "PROJ",
      host: "https://example.com"
    });
  }

  it("should handle missing optional fields", () => {
    const issue: JiraIssue = someJiraIssue();
    delete issue.fields.assignee;
    delete issue.fields.duedate

    const converter = getConverter();
    const document = converter.convertToDocuments([issue])[0];

    expect(document).toBeDefined();
    expect(document.pageContent).toContain(issue.fields.summary);
    expect(document.pageContent).toContain("Assignee: Unassigned");
    expect(document.pageContent).not.toMatch(/.*^Due Date: .*/m);
    expect(document.metadata).toEqual({
      id: issue.id,
      host: converter.host,
      projectKey: converter.projectKey
    });
  });

  it("should format the document content properly", () => {
    const converter = getConverter();
    const issue = someJiraIssue();
    const document = converter.convertToDocuments([issue])[0];

    expect(document.pageContent).toContain(issue.fields.summary);
    expect(document.pageContent).toContain(issue.fields.description);
    expect(document.pageContent).toContain(issue.fields.labels?.join(", ") || "");
    expect(document.pageContent).toContain(issue.fields.reporter?.displayName || "");
    expect(document.pageContent).toContain(issue.fields.assignee?.displayName || "Unassigned");
    expect(document.pageContent).toContain(issue.fields.duedate || "");
    expect(document.pageContent).toContain(issue.fields.timeestimate?.toString() || "");
    expect(document.pageContent).toContain(issue.fields.timespent?.toString() || "");
    expect(document.pageContent).toContain(issue.fields.resolutiondate || "");
    expect(document.pageContent).toContain(issue.fields.progress.percent?.toString() || "");
  });
});

export function someJiraIssueType(overrides: Partial<JiraIssueType> = {}): JiraIssueType {
  const baseIssueType: JiraIssueType = {
    avatarId: faker.number.int({ min: 1, max: 100 }),
    description: faker.lorem.sentence(),
    entityId: faker.string.uuid(),
    hierarchyLevel: faker.number.int({ min: 1, max: 5 }),
    iconUrl: faker.image.url(),
    id: faker.string.numeric(5),
    name: faker.helpers.arrayElement(['Bug', 'Task', 'Story', 'Epic']),
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

export function someJiraPriority(overrides: Partial<JiraPriority> = {}): JiraPriority {
  const basePriority: JiraPriority = {
    iconUrl: faker.image.url(),
    id: faker.string.numeric(2),
    name: faker.helpers.arrayElement(['Highest', 'High', 'Medium', 'Low', 'Lowest']),
    self: faker.internet.url(),
  };

  return {
    ...basePriority,
    ...overrides,
  };
}

export function someJiraProgress(overrides: Partial<JiraProgress> = {}): JiraProgress {
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

export function someJiraProject(overrides: Partial<JiraProject> = {}): JiraProject {
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

export function someJiraStatusCategory(overrides: Partial<JiraStatusCategory> = {}): JiraStatusCategory {
  const baseStatusCategory: JiraStatusCategory = {
    self: faker.internet.url(),
    id: faker.number.int({ min: 1, max: 5 }),
    key: faker.helpers.arrayElement(['new', 'indeterminate', 'done']),
    colorName: faker.helpers.arrayElement(['blue-gray', 'yellow', 'green']), 
    name: faker.helpers.arrayElement(['To Do', 'In Progress', 'Done']),
  };

  return {
    ...baseStatusCategory,
    ...overrides,
  };
}


export function someJiraStatus(overrides: Partial<JiraStatus> = {}): JiraStatus {
  const baseStatus: JiraStatus = {
    self: faker.internet.url(),
    description: faker.lorem.sentence(),
    iconUrl: faker.image.url(),
    name: faker.helpers.arrayElement(['To Do', 'In Progress', 'Done', 'Blocked']),
    id: faker.string.numeric(2),
    statusCategory: someJiraStatusCategory(),
  };

  return {
    ...baseStatus,
    ...overrides,
  };
}


export function someJiraIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  const issueKey = `${faker.string.alpha(4).toUpperCase()}-${faker.number.int({ min: 1, max: 9999 })}`;
  
  const baseIssue: JiraIssue = {
    expand: "renderedFields",
    id: faker.string.numeric(5),
    self: `https://${faker.internet.domainName()}/rest/api/2/issue/${issueKey}`,
    key: issueKey,
    fields: {
      assignee: faker.datatype.boolean() ? someJiraUser() : undefined,
      created: faker.date.past().toISOString(),
      description: faker.lorem.paragraph(),
      issuelinks: [],
      issuetype: someJiraIssueType(),
      labels: faker.datatype.boolean() ? 
        Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.word.noun()) : 
        undefined,
      priority: someJiraPriority(),
      progress: someJiraProgress(),
      project: someJiraProject(),
      reporter: faker.datatype.boolean() ? someJiraUser() : undefined,
      creator: someJiraUser(),
      resolutiondate: faker.datatype.boolean() ? faker.date.recent().toISOString() : undefined,
      status: someJiraStatus(),
      subtasks: [],
      summary: faker.lorem.sentence(),
      timeestimate: faker.datatype.boolean() ? faker.number.int({ min: 1, max: 100 }) * 3600 : undefined,
      timespent: faker.datatype.boolean() ? faker.number.int({ min: 1, max: 100 }) * 3600 : undefined,
      updated: faker.date.recent().toISOString(),
      duedate: faker.datatype.boolean() ? faker.date.future().toISOString() : undefined,
    },
  };
  console.log(baseIssue.fields.duedate);

  return {
    ...baseIssue,
    ...overrides,
  };
}