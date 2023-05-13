import type * as tst from "typescript";
import { AcceptableNodeTypes } from "./types.js";

export abstract class NodeHandler {
  constructor(protected parentHandler?: NodeHandler) {}

  abstract accepts(
    node: AcceptableNodeTypes
  ): Promise<AcceptableNodeTypes | boolean>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract handle(node: AcceptableNodeTypes): Promise<any>;
}

export class TSImporter {
  static tsInstance: typeof tst;

  static async importTS() {
    try {
      if (!TSImporter.tsInstance) {
        TSImporter.tsInstance = await import("typescript");
      }
      return TSImporter.tsInstance;
    } catch (e) {
      throw new Error(
        "Failed to import typescript. Please install typescript (i.e. npm install typescript)."
      );
    }
  }
}
