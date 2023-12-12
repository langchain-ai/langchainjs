import {
  JIRA_CATCH_ALL_PROMPT,
  JIRA_GET_ALL_PROJECTS_PROMPT,
  JIRA_ISSUE_CREATE_PROMPT,
  JIRA_JQL_PROMPT,
} from "./prompt.js";

import { Toolkit } from "../base.js";
import { JiraAction, JiraAPIWrapper } from "../../../tools/jira.js";

export {
  JIRA_CATCH_ALL_PROMPT,
  JIRA_GET_ALL_PROJECTS_PROMPT,
  JIRA_ISSUE_CREATE_PROMPT,
  JIRA_JQL_PROMPT,
};

/**
 * Class that represents a toolkit for working with the Jira API. It
 * extends the BaseToolkit class and has a tools property that contains
 * an array of JiraAction instances.
 */
export class JiraToolkit extends Toolkit {
  tools = [
    new JiraAction({
      name: "JQL Query",
      description: JIRA_JQL_PROMPT,
      mode: "jql",
      apiWrapper: this.apiWrapper,
    }),
    new JiraAction({
      name: "Get Projects",
      description: JIRA_GET_ALL_PROJECTS_PROMPT,
      mode: "get_projects",
      apiWrapper: this.apiWrapper,
    }),
    new JiraAction({
      name: "Create Issue",
      description: JIRA_ISSUE_CREATE_PROMPT,
      mode: "create_issue",
      apiWrapper: this.apiWrapper,
    }),
    new JiraAction({
      name: "Catch all Jira API call",
      description: JIRA_CATCH_ALL_PROMPT,
      mode: "other",
      apiWrapper: this.apiWrapper,
    }),
  ];

  constructor(readonly apiWrapper: JiraAPIWrapper) {
    super();
  }
}
