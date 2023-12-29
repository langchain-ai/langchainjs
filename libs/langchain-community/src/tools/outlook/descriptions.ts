export const SEND_MAIL_TOOL_DESCRIPTION = `
A tool for sending emails.
input instructions:
input a JSON formatted email message with the following four keys:
'subject', 'content', 'to', and 'cc'.
The 'subject' should be a brief title for the email,
'content' should contain the body of the email,
'to' should be an array of the recipient's email address,
and 'cc' should be an array of any additional recipient's email address.
The 'cc' key is optional, just give an empty array if no cc.
Ensure that the JSON object is correctly formatted and includes all four specified keys.
`;

export const READ_MAIL_TOOL_DESCRIPTION = `A tool for reading emails.
1. You can do a search on messages and specify only a value without specific message properties,
the search is carried out on the default search properties of from, subject, and body.
2. You can search messages by specifying message property names in the following table
and a value to search for in those properties.
Properties: body, cc, from, received (date e.g.07/23/2018), recipients (to, cc, and bcc),
sent (date e.g. 07/23/2018), subject, to.

INPUT:
input empty string to get all emails (up to 5).
Search on default properties: $search="<value>"
On specified property: $search="<property>:<value>"
Example: $search="sent:07/23/2018"
`;
