import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

/**
 * Interface representing the parameters for configuring the TaskadeLoader.
 * It includes optional properties for the personal access token and project id.
 */
export interface TaskadeLoaderParams {
  personalAccessToken?: string;
  projectId: string;
}

/**
 * Interface representing a Taskade project. It includes properties for the
 * id, text, parentId and completed.
 */
export interface TaskadeProject {
  tasks: Array<{
    id: string;
    text: string;
    parentId: string;
    completed: boolean;
  }>;
}

/**
 * Class representing a document loader for loading Taskade project. It
 * extends the BaseDocumentLoader and implements the TaskadeLoaderParams
 * interface. The constructor takes a config object as a parameter, which
 * contains the personal access token and project ID.
 * @example
 * ```typescript
 * const loader = new TaskadeProjectLoader({
 *   personalAccessToken: "TASKADE_PERSONAL_ACCESS_TOKEN",
 *   projectId: "projectId",
 * });
 * const docs = await loader.load();
 * ```
 */
export class TaskadeProjectLoader
  extends BaseDocumentLoader
  implements TaskadeLoaderParams
{
  public readonly personalAccessToken?: string;

  public readonly projectId: string;

  private headers: Record<string, string> = {};

  constructor({
    personalAccessToken = getEnvironmentVariable(
      "TASKADE_PERSONAL_ACCESS_TOKEN"
    ),
    projectId,
  }: TaskadeLoaderParams) {
    super();
    this.personalAccessToken = personalAccessToken;
    this.projectId = projectId;

    if (this.personalAccessToken) {
      this.headers = {
        Authorization: `Bearer ${this.personalAccessToken}`,
      };
    }
  }

  /**
   * Fetches the Taskade project using the Taskade API and returns it as a
   * TaskadeProject object.
   * @returns A Promise that resolves to a TaskadeProject object.
   */
  private async getTaskadeProject(): Promise<TaskadeProject> {
    const tasks = [];
    let after: string | null = null;
    let hasMoreTasks = true;
    while (hasMoreTasks) {
      const queryParamsString: string = new URLSearchParams({
        limit: "100",
        ...(after == null ? {} : { after }),
      }).toString();
      const url = `https://www.taskade.com/api/v1/projects/${this.projectId}/tasks?${queryParamsString}`;

      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `Unable to get Taskade project: ${response.status} ${JSON.stringify(
            data
          )}`
        );
      }

      if (!data) {
        throw new Error("Unable to get Taskade project");
      }

      if (data.items.length === 0) {
        hasMoreTasks = false;
      } else {
        after = data.items[data.items.length - 1].id;
      }

      tasks.push(...data.items);
    }

    return { tasks };
  }

  /**
   * Fetches the Taskade project using the Taskade API, creates a Document instance
   * with the JSON representation of the file as the page content and the
   * API URL as the metadata, and returns it.
   * @returns A Promise that resolves to an array of Document instances.
   */
  public async load(): Promise<Document[]> {
    const data = await this.getTaskadeProject();

    const metadata = { projectId: this.projectId };
    const text = data.tasks.map((t) => t.text).join("\n");

    return [new Document({ pageContent: text, metadata })];
  }
}
