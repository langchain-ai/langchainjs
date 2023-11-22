import { Tool } from "./base.js";

/**
 * Interface that represents the configuration options for a JiraAction.
 * It extends the BaseToolConfig interface from the BaseTool class.
 */

import { Version3Client } from "jira.js";
import { Serializable } from "../load/serializable.js";

export interface JiraAPIWrapper {
  host: string;
  username: string;
  password: string;
}

export class JiraAPIWrapper extends Serializable {
  lc_namespace = ["langchain", "tools", "jira"];

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      username: "JIRA_USERNAME",
      password: "JIRA_PASSWORD",
    };
  }

  constructor(params: JiraAPIWrapper) {
    super(params);

    const jiraHost = params.host;
    const jiraUsername = params.username;
    const jiraPassword = params.password;

    const client = new Version3Client({
      host: jiraHost,
      authentication: {
        basic: {
          username: jiraUsername,
          password: jiraPassword,
        },
      },
    });
  }

  //TODO: takes in an issues object and returns a list of the issues issues
  protected _parse_issues(
    issues: Record<string, any>
  ): Array<Record<string, any>> {
    return [];
  }

  protected _parse_projects(
    projects: Array<Record<string, any>>
  ): Array<Record<string, any>> {
    return [];
  }

  async jqlQuery(query: string): Promise<string> {
    return "";
  }

  async getProjects(query: string): Promise<string> {
    return "";
  }

  async createIssue(query: string): Promise<string> {
    return "";
  }

  async createPage(query: string): Promise<string> {
    return "";
  }

  async other(query: string): Promise<string> {
    return "";
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
        { name: "Create confluence page", value: "create_page" },
      ],
    };
  }

  async run(query: string) {
    switch (this.mode) {
      case "jql":
        return this.apiWrapper.jqlQuery(query);
      case "get_projects":
        return this.apiWrapper.getProjects(query);
      case "create_issue":
        return this.apiWrapper.createIssue(query);
      case "other":
        return this.apiWrapper.other(query);
      case "create_page":
        return this.apiWrapper.createPage(query);
      default:
        throw new Error(`Invalid mode: ${this.mode}`);
    }
  }

  /** @ignore */
  async _call(input: string) {
    return this.run(input);
  }
}
