import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

export type JiraStatusCategory = {
  self: string;
  id: number;
  key: string;
  colorName: string;
  name: string;
};

export type JiraStatus = {
  self: string;
  description: string;
  iconUrl: string;
  name: string;
  id: string;
  statusCategory: JiraStatusCategory;
};

export type JiraUser = {
  accountId: string;
  accountType: string;
  active: boolean;
  avatarUrls: {
    "16x16": string;
    "24x24": string;
    "32x32": string;
    "48x48": string;
  };
  displayName: string;
  emailAddress: string;
  self: string;
  timeZone: string;
};

export type JiraIssueType = {
  avatarId: number;
  description: string;
  entityId: string;
  hierarchyLevel: number;
  iconUrl: string;
  id: string;
  name: string;
  self: string;
  subtask: boolean;
};

export type JiraPriority = {
  iconUrl: string;
  id: string;
  name: string;
  self: string;
};

export type JiraProgress = {
  progress: number;
  total: number;
  percent?: number;
};

export type JiraProject = {
  avatarUrls: {
    "16x16": string;
    "24x24": string;
    "32x32": string;
    "48x48": string;
  };
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  self: string;
  simplified: boolean;
};

export type JiraSubTask = {
  id: string;
  key: string;
  self: string;
  fields: {
    issuetype: JiraIssueType;
    priority: JiraPriority;
    status: JiraStatus;
    summary: string;
  };
};

export type JiraIssueLinkType = {
  id: string;
  name: string;
  inward: string;
  outward: string;
  self: string;
};

export type JiraBriefIssue = {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority: JiraPriority;
    issuetype: JiraIssueType;
  };
};

export type JiraIssueLink = {
  id: string;
  self: string;
  type: JiraIssueLinkType;
  inwardIssue?: JiraBriefIssue;
  outwardIssue?: JiraBriefIssue;
};

export type JiraIssue = {
  expand: string;
  id: string;
  self: string;
  key: string;
  fields: {
    assignee?: JiraUser;
    created: string;
    description: string;
    issuelinks: JiraIssueLink[];
    issuetype: JiraIssueType;
    labels?: string[];
    priority: JiraPriority;
    progress: JiraProgress;
    project: JiraProject;
    reporter?: JiraUser;
    creator: JiraUser;
    resolutiondate?: string;
    status: JiraStatus;
    subtasks: JiraSubTask[];
    summary: string;
    timeestimate?: number;
    timespent?: number;
    updated: string;
    duedate?: string;
    parent?: JiraBriefIssue;
  };
};

export type JiraAPIResponse = {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
};

/**
 * Interface representing the parameters for configuring the
 * JiraDocumentConverter.
 */
export interface JiraDocumentConverterParams {
  host: string;
  projectKey: string;
}

/**
 * Class responsible for converting Jira issues to Document objects
 */
export class JiraDocumentConverter {
  public readonly host: string;

  public readonly projectKey: string;

  constructor({ host, projectKey }: JiraDocumentConverterParams) {
    this.host = host;
    this.projectKey = projectKey;
  }

  public convertToDocuments(issues: JiraIssue[]): Document[] {
    return issues.map((issue) => this.documentFromIssue(issue));
  }

  private documentFromIssue(issue: JiraIssue): Document {
    return new Document({
      pageContent: this.formatIssueInfo({
        issue,
        host: this.host,
      }),
      metadata: {
        id: issue.id,
        host: this.host,
        projectKey: this.projectKey,
      },
    });
  }

  private formatIssueInfo({
    issue,
    host,
  }: {
    issue: JiraIssue;
    host: string;
  }): string {
    let text = `Issue: ${this.formatMainIssueInfoText({ issue, host })}\n`;
    text += `Project: ${issue.fields.project.name} (${issue.fields.project.key}, ID ${issue.fields.project.id})\n`;
    text += `Status: ${issue.fields.status.name}\n`;
    text += `Priority: ${issue.fields.priority.name}\n`;
    text += `Type: ${issue.fields.issuetype.name}\n`;
    text += `Creator: ${issue.fields.creator?.displayName}\n`;

    if (issue.fields.labels && issue.fields.labels.length > 0) {
      text += `Labels: ${issue.fields.labels.join(", ")}\n`;
    }

    text += `Created: ${issue.fields.created}\n`;
    text += `Updated: ${issue.fields.updated}\n`;

    if (issue.fields.reporter) {
      text += `Reporter: ${issue.fields.reporter.displayName}\n`;
    }

    text += `Assignee: ${issue.fields.assignee?.displayName ?? "Unassigned"}\n`;

    if (issue.fields.duedate) {
      text += `Due Date: ${issue.fields.duedate}\n`;
    }

    if (issue.fields.timeestimate) {
      text += `Time Estimate: ${issue.fields.timeestimate}\n`;
    }

    if (issue.fields.timespent) {
      text += `Time Spent: ${issue.fields.timespent}\n`;
    }

    if (issue.fields.resolutiondate) {
      text += `Resolution Date: ${issue.fields.resolutiondate}\n`;
    }

    if (issue.fields.description) {
      text += `Description: ${issue.fields.description}\n`;
    }

    if (issue.fields.progress?.percent) {
      text += `Progress: ${issue.fields.progress.percent}%\n`;
    }

    if (issue.fields.parent) {
      text += `Parent Issue: ${this.formatMainIssueInfoText({
        issue: issue.fields.parent,
        host,
      })}\n`;
    }

    if (issue.fields.subtasks?.length > 0) {
      text += `Subtasks:\n`;
      issue.fields.subtasks.forEach((subtask) => {
        text += `  - ${this.formatMainIssueInfoText({
          issue: subtask,
          host,
        })}\n`;
      });
    }

    if (issue.fields.issuelinks?.length > 0) {
      text += `Issue Links:\n`;
      issue.fields.issuelinks.forEach((link) => {
        text += `  - ${link.type.name}\n`;
        if (link.inwardIssue) {
          text += `    - ${this.formatMainIssueInfoText({
            issue: link.inwardIssue,
            host,
          })}\n`;
        }
        if (link.outwardIssue) {
          text += `    - ${this.formatMainIssueInfoText({
            issue: link.outwardIssue,
            host,
          })}\n`;
        }
      });
    }

    return text;
  }

  private getLinkToIssue({
    issueKey,
    host,
  }: {
    issueKey: string;
    host: string;
  }): string {
    return `${host}/browse/${issueKey}`;
  }

  private formatMainIssueInfoText({
    issue,
    host,
  }: {
    issue: JiraIssue | JiraBriefIssue;
    host: string;
  }): string {
    const link = this.getLinkToIssue({
      issueKey: issue.key,
      host,
    });

    const text = `${issue.key} (ID ${issue.id}) - ${issue.fields.summary} (${link})`;

    return text;
  }
}

/**
 * Interface representing the parameters for configuring the
 * JiraProjectLoader.
 */
export interface JiraProjectLoaderParams {
  host: string;
  projectKey: string;
  username: string;
  accessToken: string;
  limitPerRequest?: number;
  createdAfter?: Date;
}

const API_ENDPOINTS = {
  SEARCH: "/rest/api/2/search",
};

/**
 * Class representing a document loader for loading pages from Confluence.
 */
export class JiraProjectLoader extends BaseDocumentLoader {
  private readonly accessToken: string;

  public readonly host: string;

  public readonly projectKey: string;

  public readonly username: string;

  public readonly limitPerRequest: number;

  private readonly createdAfter?: Date;

  private readonly documentConverter: JiraDocumentConverter;

  constructor({
    host,
    projectKey,
    username,
    accessToken,
    limitPerRequest = 100,
    createdAfter,
  }: JiraProjectLoaderParams) {
    super();
    this.host = host;
    this.projectKey = projectKey;
    this.username = username;
    this.accessToken = accessToken;
    this.limitPerRequest = limitPerRequest;
    this.createdAfter = createdAfter;
    this.documentConverter = new JiraDocumentConverter({ host, projectKey });
  }

  private buildAuthorizationHeader(): string {
    return `Basic ${Buffer.from(
      `${this.username}:${this.accessToken}`
    ).toString("base64")}`;
  }

  public async load(): Promise<Document[]> {
    try {
      const allJiraIssues = await this.loadAsIssues();
      return this.documentConverter.convertToDocuments(allJiraIssues);
    } catch (error) {
      console.error("Error:", error);
      return [];
    }
  }

  public async loadAsIssues(): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];

    for await (const issues of this.fetchIssues()) {
      allIssues.push(...issues);
    }

    return allIssues;
  }

  protected toJiraDateString(date: Date | undefined): string | undefined {
    if (!date) {
      return undefined;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayOfMonth}`;
  }

  protected async *fetchIssues(): AsyncIterable<JiraIssue[]> {
    const authorizationHeader = this.buildAuthorizationHeader();
    const url = `${this.host}${API_ENDPOINTS.SEARCH}`;
    const createdAfterAsString = this.toJiraDateString(this.createdAfter);
    let startAt = 0;

    while (true) {
      try {
        const jqlProps = [
          `project=${this.projectKey}`,
          ...(createdAfterAsString ? [`created>=${createdAfterAsString}`] : []),
        ];
        const params = new URLSearchParams({
          jql: jqlProps.join(" AND "),
          startAt: `${startAt}`,
          maxResults: `${this.limitPerRequest}`,
        });
        const pageUrl = `${url}?${params}`;

        const options = {
          method: "GET",
          headers: {
            Authorization: authorizationHeader,
            Accept: "application/json",
          },
        };

        const response = await fetch(pageUrl, options);
        const data: JiraAPIResponse = await response.json();

        if (!data.issues || data.issues.length === 0) break;

        yield data.issues;
        startAt += this.limitPerRequest;
      } catch (error) {
        console.error(error);
        yield [];
      }
    }
  }
}
