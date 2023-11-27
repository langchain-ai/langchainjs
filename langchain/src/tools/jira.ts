import { Tool } from "./base.js";

/**
 * Interface that represents the configuration options for a JiraAction.
 * It extends the BaseToolConfig interface from the BaseTool class.
 */

import { Version3Client, Version3Models } from "jira.js";
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
  args: Object;
};

export class JiraAPIWrapper extends Serializable {
  jira: Version3Client;

  lc_namespace = ["langchain", "tools", "jira"];

  // get lc_secrets(): { [key: string]: string } | undefined {
  //   return {
  //     email: "JIRA_EMAIL",
  //     apiToken: "JIRA_API_TOKEN",
  //   };
  // }

  constructor(jira: Version3Client) {
    super(jira);
    this.jira = jira;
  }

  //TODO: takes in an issues object and returns a list of the issues issues
  protected _parse_issues(issues: Version3Models.SearchResults): Array<Issue> {
    var parsed: Array<Issue> = [];

    issues.issues?.forEach((issue) => {
      var rel_issues: Array<{
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

      parsed.push({
        key: issue.key,
        summary: issue.fields.summary,
        created: issue.fields.created,
        assignee: issue.fields.assignee.displayName,
        priority: issue.fields.priority.name,
        status: issue.fields.status.name,
        related_issues: rel_issues,
      });
    });
    return parsed;
  }

  protected _parse_projects(
    projects: Array<Version3Models.Project>
  ): Array<Project> {
    var parsed: Array<Project> = [];

    projects.forEach((project) => {
      parsed.push({
        id: project.id,
        key: project.key,
        name: project.name,
        type: project.projectTypeKey,
        style: project.style,
      });
    });

    return parsed;
  }

  async jqlQuery(query: string): Promise<string> {
    var issues = await this.jira.issueSearch.searchForIssuesUsingJqlPost({
      jql: query,
    });
    var parsed_issues = this._parse_issues(issues);
    var parsed_issues_str = `Found ${parsed_issues.length} issues:\n ${parsed_issues}`;

    return parsed_issues_str;
  }

  async getProjects(): Promise<string> {
    var projects = await this.jira.projects.searchProjects();
    var parsed_projects = this._parse_projects(projects.values);
    var parsed_projects_str = `Found ${parsed_projects.length} projects:\n ${parsed_projects}`;

    return parsed_projects_str;
  }

  async createIssue(query: string): Promise<string> {
    var params = JSON.parse(query);
    return await this.jira.issues.createIssue({ fields: params });
  }

  async other(query: string): Promise<string> {
    var params: JiraFunction = JSON.parse(query);
    params.class = params.class.toLowerCase();
    var jira_class = this.jira[params.class as keyof Version3Client];
    var jira_function = jira_class[params.method as keyof typeof jira_class];

    // @ts-ignore
    return await jira_function(params.args);
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
