import { google } from "googleapis";
import { CallbackManagerForToolRun } from "../../callbacks/manager.js";
import { GmailBaseTool, GmailBaseToolParams } from "./base.js";

export class GmailGetThread extends GmailBaseTool {
    name = "gmail_get_thread";

    description = "Get a thread from Gmail";

    constructor(fields: GmailBaseToolParams) {
        super(fields);
      }
    
    async _call(threadId: string, runManager?: CallbackManagerForToolRun) {
        const auth = await this.getAuth();
    
        const gmail = google.gmail({ version: "v1", auth });
    
        const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        });
    
        const { data } = thread;
    
        if (!data) {
        throw new Error("No data returned from Gmail");
        }
    
        const { messages } = data;
    
        if (!messages) {
        throw new Error("No messages returned from Gmail");
        }

        const messageDataList = [];

        for (const message of messages) {
            const { payload } = message;

            if (!payload) {
                throw new Error("No payload returned from Gmail");
            }

            const { headers } = payload;
    
            if (!headers) {
            throw new Error("No headers returned from Gmail");
            }
        
            const subject = headers.find((header) => header.name === "Subject");
        
            if (!subject) {
            throw new Error("No subject returned from Gmail");
            }
        
            const body = headers.find((header) => header.name === "Body");
        
            if (!body) {
            throw new Error("No body returned from Gmail");
            }
        
            const from = headers.find((header) => header.name === "From");
        
            if (!from) {
            throw new Error("No from returned from Gmail");
            }
        
            const to = headers.find((header) => header.name === "To");
        
            if (!to) {
            throw new Error("No to returned from Gmail");
            }

            const date = headers.find((header) => header.name === "Date");

            if (!date) {
                throw new Error("No date returned from Gmail");
            }

            const messageIdHeader = headers.find(
                (header) => header.name === "Message-ID"
            );

            if (!messageIdHeader) {
                throw new Error("No message id returned from Gmail");
            }

            const messageData = {
                subject: subject.value,
                body: body.value,
                from: from.value,
                to: to.value,
                date: date.value,
                messageId: messageIdHeader.value,
            };

            messageDataList.push(messageData);
        }
    
        return messageDataList;
    }
}