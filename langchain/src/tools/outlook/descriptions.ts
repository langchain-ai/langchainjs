export const SEND_MAIL_TOOL_DESCRIPTION = "A tool for sending emails. \
input instructions: \
input a JSON formatted email message with the following four keys:\
'subject', 'content', 'to', and 'cc'.\
The 'subject' should be a brief title for the email, \
'content' should contain the body of the email, \
'to' should be an array of the recipient's email address, \
and 'cc' should be an array of any additional recipient's email address. \
The 'cc' key is optional, just give empty array if no cc. \
Ensure that the JSON object is correctly formatted and includes all four specified keys.\
This is an example of a valid JSON object: \
";
// {\"subject\":\"Example Subject\",\"content\":\"Example Content\",\"to":[\"team@example.com\"],\"cc\":[]}\
// ";


export const READ_MAIL_TOOL_DESCRIPTION = `A tool for reading emails.`;