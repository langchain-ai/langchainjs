import { Version3Client, Version3Models } from "jira.js";
import { Tool } from "./base.js";

/**
 * Interface that represents the configuration options for a JiraAction.
 * It extends the BaseToolConfig interface from the BaseTool class.
 */

import { Serializable } from "../load/serializable.js";

export interface JiraAPIWrapperParams {
  host: string;
  email: string;
  jiraAPIToken: string;
}

export type Issue = {
  key: string;
  summary: string;
  created: string;
  assignee: string | undefined;
  priority: string | undefined;
  status: string | undefined;
  related_issues: Array<{
    rel_type: string | undefined;
    rel_key: string | undefined;
    rel_summary: string | undefined;
  }>;
};

export type Project = {
  id: string;
  key: string;
  name: string;
  type: string | undefined;
  style: string | undefined;
};

export type JiraFunction = {
  class: string;
  method: string;
  args: object;
};

export class JiraAPIWrapper extends Serializable {
  jira: Version3Client;

  lc_namespace = ["langchain", "tools", "jira"];

  constructor(jira: Version3Client) {
    super(jira);
    this.jira = jira;
  }

  protected _parse_issues(issues: Version3Models.SearchResults): Array<string> {
    const parsed: Array<string> = [];

    issues.issues?.forEach((issue) => {
      const rel_issues: Array<{
        rel_type: string | undefined;
        rel_key: string | undefined;
        rel_summary: string | undefined;
      }> = [];

      issue.fields.issuelinks.forEach((related_issue) => {
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

  protected _parse_projects(
    projects: Array<Version3Models.Project>
  ): Array<string> {
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

  async jqlQuery(query: string): Promise<string> {
    const issues = await this.jira.issueSearch.searchForIssuesUsingJqlPost({
      jql: query,
    });
    const parsed_issues = this._parse_issues(issues);
    const parsed_issues_str = `Found ${parsed_issues.length} issues:\n ${parsed_issues}`;

    return parsed_issues_str;
  }

  async getProjects(): Promise<string> {
    const projects = await this.jira.projects.searchProjects();
    const parsed_projects = this._parse_projects(projects.values);
    const parsed_projects_str = `Found ${parsed_projects.length} projects:\n ${parsed_projects}`;

    return parsed_projects_str;
  }

  async createIssue(query: string): Promise<string> {
    const params = JSON.parse(query);

    return await this.jira.issues.createIssue({ fields: params });
  }

  async other(query: string): Promise<string> {
    const params: JiraFunction = JSON.parse(query);
    params.class = params.class.toLowerCase();
    
    return await this.jira[params.class][params.method](params.args);
  }

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
