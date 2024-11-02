import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders";
import { Parser, DomHandler } from "htmlparser2";

interface Metadata {
    [key: string]: string;
}

export class ParseOracleDocMetadata {
    private metadata: Metadata;
    private match: boolean;

    constructor() {
        this.metadata = {};
        this.match = false;
    }

    private handleStartTag(tag: string, attrs: { name: string; value: string | null }[]) {
        if (tag === "meta") {
            let entry: string | undefined;
            let content: string | null = null;

            attrs.forEach(({ name, value }) => {
                if (name === "name") entry = value ?? "";
                if (name === "content") content = value;
            });

            if (entry) {
                this.metadata[entry] = content ?? "N/A";
            }
        } else if (tag === "title") {
            this.match = true;
        }
    }

    private handleData(data: string) {
        if (this.match) {
            this.metadata["title"] = data;
            this.match = false;
        }
    }

    public getMetadata(): Metadata {
        return this.metadata;
    }

    public parse(htmlString: string): void {
        // We add this method to incorperate the feed method of HTMLParser in Python
        interface Attribute {
            name: string;
            value: string | null;
        }

        interface ParserOptions {
            onopentag: (name: string, attrs: Record<string, string>) => void;
            ontext: (text: string) => void;
        }

        const parser = new Parser(
            {
                onopentag: (name: string, attrs: Record<string, string>) =>
                    this.handleStartTag(
                        name,
                        Object.entries(attrs).map(([name, value]): Attribute => ({
                            name,
                            value: value as string | null,
                        }))
                    ),
                ontext: (text: string) => this.handleData(text),
            } as ParserOptions,
            { decodeEntities: true }
        );
        parser.write(htmlString);
        parser.end();
    }
    
}