import { StreamEvent } from "../tracers/event_stream.js";
import type { RunnableInterface } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRunnableInterface(thing: any): thing is RunnableInterface {
  return thing ? thing.lc_runnable : false;
}

/**
 * Utility to filter the root event in the streamEvents implementation.
 * This is simply binding the arguments to the namespace to make save on
 * a bit of typing in the streamEvents implementation.
 *
 * TODO: Refactor and remove.
 */
export class _RootEventFilter {
  includeNames?: string[];

  includeTypes?: string[];

  includeTags?: string[];

  excludeNames?: string[];

  excludeTypes?: string[];

  excludeTags?: string[];

  constructor(fields: {
    includeNames?: string[];
    includeTypes?: string[];
    includeTags?: string[];
    excludeNames?: string[];
    excludeTypes?: string[];
    excludeTags?: string[];
  }) {
    this.includeNames = fields.includeNames;
    this.includeTypes = fields.includeTypes;
    this.includeTags = fields.includeTags;
    this.excludeNames = fields.excludeNames;
    this.excludeTypes = fields.excludeTypes;
    this.excludeTags = fields.excludeTags;
  }

  includeEvent(event: StreamEvent, rootType: string): boolean {
    let include =
      this.includeNames === undefined &&
      this.includeTypes === undefined &&
      this.includeTags === undefined;
    const eventTags = event.tags ?? [];

    if (this.includeNames !== undefined) {
      include = include || this.includeNames.includes(event.name);
    }
    if (this.includeTypes !== undefined) {
      include = include || this.includeTypes.includes(rootType);
    }
    if (this.includeTags !== undefined) {
      include =
        include || eventTags.some((tag) => this.includeTags?.includes(tag));
    }

    if (this.excludeNames !== undefined) {
      include = include && !this.excludeNames.includes(event.name);
    }
    if (this.excludeTypes !== undefined) {
      include = include && !this.excludeTypes.includes(rootType);
    }
    if (this.excludeTags !== undefined) {
      include =
        include && eventTags.every((tag) => !this.excludeTags?.includes(tag));
    }

    return include;
  }
}

export const toBase64Url = (str: string): string => {
  // Use btoa for compatibility, assume ASCII
  const encoded = btoa(str);
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
