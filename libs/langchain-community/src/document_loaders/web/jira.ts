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
    description: ADFNode;
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

export type JiraDescriptionFormatter = (
  content: ADFNode | null | undefined,
  issue?: JiraIssue
) => string | ADFNode | null;

export type JiraAPIResponse = {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
};

export interface ADFNode {
  type: string;
  text?: string;
  content?: ADFNode[];
  attrs?: Record<string, unknown>;
}

export interface ADFDocument extends ADFNode {
  type: "doc";
  version: number;
  content: ADFNode[];
}

export function adfToText(adf: ADFNode | null | undefined): string {
  if (!adf || !adf.content) return "";
  const recur = (node: ADFNode): string => {
    if (node.text) return node.text;
    if (node.content) return node.content.map(recur).join("");
    return "";
  };
  return recur(adf).trim();
}

export const formatJiraDescriptionAsJSON: JiraDescriptionFormatter = (
  adfContent: ADFNode | null | undefined
): ADFNode | null => {
  if (!adfContent) return null;

  const traverseNode = (node: ADFNode): ADFNode => {
    if (typeof node === "string") return { type: "text", text: node };

    const result: ADFNode = { type: node.type || "unknown" };
    if (node.text) result.text = node.text;
    if (node.attrs) result.attrs = node.attrs;
    if (node.content) result.content = node.content.map(traverseNode);
    return result;
  };

  return traverseNode(adfContent);
};

export const formatJiraDescriptionAsText: JiraDescriptionFormatter = (
  adfContent: ADFNode | null | undefined
): string => {
  if (!adfContent) return "";

  const traverseNode = (node: ADFNode): string => {
    if (node.text) return node.text;
    if (node.content) return node.content.map(traverseNode).join("");
    return "";
  };

  return traverseNode(adfContent).trim();
};

/**
 * Interface representing the parameters for configuring the
 * JiraDocumentConverter.
 */
export interface JiraDocumentConverterParams {
  host: string;
  projectKey: string;
  formatter?: JiraDescriptionFormatter;
}

/**
 * Class responsible for converting Jira issues to Document objects
 */
export class JiraDocumentConverter {
  public readonly host: string;

  public readonly projectKey: string;

  private readonly formatter: JiraDescriptionFormatter;

  constructor({ host, projectKey, formatter }: JiraDocumentConverterParams) {
    this.host = host;
    this.projectKey = projectKey;
    this.formatter = formatter ?? formatJiraDescriptionAsText;
  }

  public convertToDocuments(issues: JiraIssue[]): Document[] {
    return issues.map((issue) => this.documentFromIssue(issue));
  }

  private documentFromIssue(issue: JiraIssue): Document {
    return new Document({
      pageContent: this.formatIssueInfo({ issue, host: this.host }),
      metadata: {
        id: issue.id,
        host: this.host,
        projectKey: this.projectKey,
        created: issue.fields.created,
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
      const formattedDescription = this.formatter(
        issue.fields.description,
        issue
      );
      const descText =
        typeof formattedDescription === "string"
          ? formattedDescription
          : JSON.stringify(formattedDescription, null, 2);

      text += `Description: ${descText}\n`;
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
  username?: string;
  accessToken?: string;
  personalAccessToken?: string;
  limitPerRequest?: number;
  createdAfter?: Date;
  filterFn?: (issue: JiraIssue) => boolean;
  descriptionFormatter?: JiraDescriptionFormatter;
}

/**
 * Class representing a document loader for loading pages from Confluence.
 */
export class JiraProjectLoader extends BaseDocumentLoader {
  private readonly accessToken?: string;

  public readonly host: string;

  public readonly projectKey: string;

  public readonly username?: string;

  public readonly limitPerRequest: number;

  private readonly createdAfter?: Date;

  private readonly filterFn?: (issue: JiraIssue) => boolean;

  private readonly documentConverter: JiraDocumentConverter;

  private readonly personalAccessToken?: string;

  constructor({
    host,
    projectKey,
    username,
    accessToken,
    limitPerRequest = 100,
    createdAfter,
    personalAccessToken,
    filterFn,
    descriptionFormatter: formatter,
  }: JiraProjectLoaderParams) {
    super();
    this.host = host;
    this.projectKey = projectKey;
    this.username = username;
    this.accessToken = accessToken;
    this.limitPerRequest = limitPerRequest;
    this.createdAfter = createdAfter;
    this.documentConverter = new JiraDocumentConverter({
      host,
      projectKey,
      formatter,
    });
    this.personalAccessToken = personalAccessToken;
    this.filterFn = filterFn;
  }

  private buildAuthorizationHeader(): string {
    if (this.personalAccessToken) {
      return `Bearer ${this.personalAccessToken}`;
    }
    return `Basic ${Buffer.from(
      `${this.username}:${this.accessToken}`
    ).toString("base64")}`;
  }

  public async load(): Promise<Document[]> {
    try {
      const allJiraIssues = await this.loadAsIssues();
      const filtered = allJiraIssues.filter((issue) => {
        if (this.filterFn) {
          return this.filterFn(issue);
        }
        return true;
      });
      return this.documentConverter.convertToDocuments(filtered);
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

  protected toJiraDateTimeString(date: Date | undefined): string | undefined {
    if (!date) return undefined;
    return date.toISOString();
  }

  protected async *fetchIssues(): AsyncIterable<JiraIssue[]> {
    const authorizationHeader = this.buildAuthorizationHeader();
    const url = `${this.host}/rest/api/3/search/jql`;
    const createdAfterAsString = this.toJiraDateTimeString(this.createdAfter);

    let nextPageToken: string | undefined;

    while (true) {
      const jqlParts = [
        `project = ${this.projectKey}`,
        ...(createdAfterAsString
          ? [`created >= "${createdAfterAsString}"`]
          : []),
      ];

      const params = new URLSearchParams({
        jql: `${jqlParts.join(" AND ")} ORDER BY created ASC, key ASC`,
        maxResults: `${this.limitPerRequest}`,
        fields: "*all",
      });

      if (nextPageToken) {
        params.set("nextPageToken", nextPageToken);
      }

      const response = await fetch(`${url}?${params}`, {
        headers: {
          Authorization: authorizationHeader,
          Accept: "application/json",
        },
      });

      const data = await response.json();

      if (data.issues?.length) {
        yield data.issues;
      }

      if (data.isLast === true) break;

      if (!data.nextPageToken) {
        throw new Error("Expected nextPageToken but none returned");
      }

      nextPageToken = data.nextPageToken;
    }
  }
}
