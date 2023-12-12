import { Tool } from "@langchain/core/tools";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export type JiraInwardIssue = {
  key: string;
  fields: { summary: string } | undefined;
};

export type JiraOutwardIssue = {
  key: string;
  fields: { summary: string } | undefined;
};

export type JiraIssueLink = {
  type: { inward: string; outward: string } | undefined;
  inwardIssue: JiraInwardIssue | undefined;
  outwardIssue: JiraOutwardIssue | undefined;
};

export type JiraIssueFields = {
  summary: string;
  created: string;
  assignee: { displayName: string };
  priority: { name: string };
  status: { name: string };
  issuelinks: Array<JiraIssueLink>;
};

export type JiraIssue = {
  key: string;
  fields: JiraIssueFields;
};

export type JiraIssueResponse = {
  issues: Array<JiraIssue> | undefined;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string | undefined;
  style: string | undefined;
};

export type JiraAPICall = {
  httpverb: string;
  endpoint: string;
  queryParams: Record<string, string>;
  bodyParams: BodyInit;
};

export type JiraProjectResponse = {
  values: Array<JiraProject>;
};

export type JiraIssueHeaderParams = {
  summary: string;
  description: string;
  project: string;
  issuetype: string;
  priority: string;
};

export interface JiraAPIWrapperParams extends AsyncCallerParams {
  host: string;
  email: string;
  apiToken?: string;
}

/**
 * A wrapper class for Jira's API. Provides methods that make use
 * of the Jira API to carry out tasks such as querying and creating,
 * issues, retrieving projects, and anything else that can be done
 * with the Jira API.
 */
export class JiraAPIWrapper {
  host: string;

  jiraEmail: string;

  jiraApiToken?: string;

  caller: AsyncCaller;

  constructor(params: JiraAPIWrapperParams) {
    this.host = params.host;
    this.jiraEmail = params.email;
    this.jiraApiToken =
      params.apiToken ?? getEnvironmentVariable("JIRA_API_TOKEN");
    this.caller = new AsyncCaller(
      typeof params === "string" ? {} : params ?? {}
    );
  }

  protected _getHeaders(): Record<string, string> {
    const headers: {
      "Content-Type": string;
      Accept: string;
      Authorization?: string;
      "X-Atlassian-Token"?: string;
    } = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(
        `${this.jiraEmail}:${this.jiraApiToken}`
      ).toString("base64")}`,
    };
    return headers;
  }

  protected _parseIssues(issues: JiraIssueResponse): Array<string> {
    const parsed: Array<string> = [];

    issues.issues?.forEach((issue: JiraIssue) => {
      const rel_issues: Array<{
        rel_type: string | undefined;
        rel_key: string | undefined;
        rel_summary: string | undefined;
      }> = [];

      issue.fields.issuelinks.forEach((related_issue: JiraIssueLink) => {
        if (related_issue.inwardIssue) {
          rel_issues.push({
            rel_type: related_issue.type?.inward,
            rel_key: related_issue.inwardIssue.key,
            rel_summary: related_issue.inwardIssue.fields?.summary,
          });
        } else {
          rel_issues.push({
            rel_type: related_issue.type?.outward,
            rel_key: related_issue.outwardIssue?.key,
            rel_summary: related_issue.outwardIssue?.fields?.summary,
          });
        }
      });

      const stringifiedIssue = `{
        key: ${issue.key},
        summary: ${issue.fields.summary},
        created: ${issue.fields.created},
        assignee: ${issue.fields.assignee.displayName},
        priority: ${issue.fields.priority.name},
        status: ${issue.fields.status.name},
        related_issues: ${rel_issues},
      }`;

      parsed.push(stringifiedIssue);
    });

    return parsed;
  }

  protected _parseProjects(projects: Array<JiraProject>): Array<string> {
    const parsed: Array<string> = [];

    projects.forEach((project) => {
      const stringifiedProject = `{
        id: ${project.id},
        key: ${project.key},
        name: ${project.name},
        type: ${project.projectTypeKey},
        style: ${project.style},
      }
      `;
      parsed.push(stringifiedProject);
    });

    return parsed;
  }

  protected _createIssueHeader(params: JiraIssueHeaderParams) {
    return `{
      "fields": {
          "summary": "${params.summary}",
          "description": {
              "content": [{
                  "content": [{
                      "text": "${params.description}",
                      "type": "text"
                  }],
                  "type": "paragraph"
              }],
              "type": "doc",
              "version": 1
          },
          "project": { "key": "${params.project}" },
          "issuetype": { "name": "${params.issuetype}" },
          "priority": { "name": "${params.priority}" }
      }
    }`;
  }

  /**
   * Performs a JQL query with the specified query to search through issues.
   * @param query The JQL query that needs to be run.
   * @returns A string specifying the number of issues found and the issues found.
   */
  async jqlQuery(query: string): Promise<string> {
    const headers = this._getHeaders();
    const queryParams = new URLSearchParams({ jql: query });
    const resp = await this.caller.call(
      fetch,
      `${this.host}/rest/api/3/search/${queryParams}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!resp.ok) {
      const error = await resp.text();
      return `Received ${error}. Make sure the correct tool is being used and try again.`;
    }
    const issues = await resp.json();
    const parsed_issues = this._parseIssues(issues);
    const parsed_issues_str = `Found ${parsed_issues.length} issues:\n ${parsed_issues}`;

    return parsed_issues_str;
  }

  /**
   * Retrieves the user's projects.
   * @returns A string specifying the number of projects found and the projects found.
   */
  async getProjects(): Promise<string> {
    const headers = this._getHeaders();
    const resp = await this.caller.call(
      fetch,
      `${this.host}/rest/api/3/project/search`,
      {
        method: "GET",
        headers,
      }
    );

    if (!resp.ok) {
      const error = await resp.text();
      return `Received ${error}. Make sure the correct tool is being used and try again.`;
    }
    const projects: unknown = await resp.json();

    const parsed_projects = this._parseProjects(
      (projects as JiraProjectResponse).values
    );
    const parsed_projects_str = `Found ${parsed_projects.length} projects:\n ${parsed_projects}`;

    return parsed_projects_str;
  }

  /**
   * Creates an issue with the specified query.
   * @param query The details of the issue.
   * @returns A string of the response from the creation of an issue.
   */
  async createIssue(query: string): Promise<string> {
    const params = JSON.parse(query);
    const headers = this._getHeaders();
    const resp = await this.caller.call(
      fetch,
      `${this.host}/rest/api/3/issue`,
      {
        method: "POST",
        headers,
        body: this._createIssueHeader(params),
      }
    );

    if (!resp.ok) {
      const error = await resp.text();
      return `Received ${error}. Make sure the correct tool is being used and try again.`;
    }

    return await resp.text();
  }

  /**
   * Performs any other Jira API call.
   * @param query The query of the corresponding Jira API call, if applicable.
   * @returns A string of the response of whichever Jira API call was made.
   */
  async other(query: string): Promise<string> {
    const params: JiraAPICall = JSON.parse(query);
    const headers = this._getHeaders();

    const queryParams = new URLSearchParams(params.queryParams);
    let resp: Response = new Response();
    if (params.httpverb === "GET" || params.httpverb === "HEAD") {
      resp = await this.caller.call(
        fetch,
        `${this.host}${params.endpoint}${queryParams}`,
        {
          method: params.httpverb,
          headers,
        }
      );
    } else {
      resp = await this.caller.call(
        fetch,
        `${this.host}${params.endpoint}${queryParams}`,
        {
          method: params.httpverb,
          headers,
          body: JSON.stringify(params.bodyParams),
        }
      );
    }

    if (!resp.ok) {
      const error = await resp.text();
      return `Received ${error}. Make sure the correct tool is being used and try again.`;
    }

    return await resp.text();
  }

  /**
   * Executes an action that is identified by mode.
   * @param mode The string representation of one of four actions.
   * @param query The query for applicable actions.
   */
  async run(mode: string, query: string) {
    switch (mode) {
      case "jql":
        return await this.jqlQuery(query);
      case "get_projects":
        return await this.getProjects();
      case "create_issue":
        return await this.createIssue(query);
      case "other":
        return await this.other(query);
      default:
        throw new Error(`Invalid mode: ${mode}`);
    }
  }
}

export interface JiraActionConfig {
  name: string;
  description: string;
  mode: string;
  apiWrapper: JiraAPIWrapper;
}

/**
 * Class that represents an action that can be performed using the Jira
 * API. It extends the BaseTool class and implements the JiraActionConfig
 * interface.
 */
export class JiraAction extends Tool implements JiraActionConfig {
  name: string;

  description: string;

  mode: string;

  apiWrapper: JiraAPIWrapper;

  constructor(config: JiraActionConfig) {
    super(...arguments);
    this.name = config.name;
    this.description = config.description;
    this.mode = config.mode;
    this.apiWrapper = config.apiWrapper;
  }

  static get prompt() {
    return {
      type: "select",
      name: "mode",
      message: "What Jira action would you like to perform?",
      choices: [
        { name: "JQL Query", value: "jql" },
        { name: "Get Projects", value: "get_projects" },
        { name: "Create Issue", value: "create_issue" },
        { name: "Catch all Jira API call", value: "other" },
      ],
    };
  }

  /** @ignore */
  async _call(input: string) {
    return await this.apiWrapper.run(this.mode, input);
  }
}
