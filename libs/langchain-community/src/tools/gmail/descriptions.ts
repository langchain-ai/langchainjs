export const CREATE_DRAFT_DESCRIPTION = `A tool for creating draft emails in Gmail.

INPUT example:
{
  "message": "Hello, this is a test draft",
  "to": ["example1@email.com", "example2@email.com"],
  "subject": "Test Draft",
  "cc": ["cc1@email.com"],
  "bcc": ["bcc1@email.com"]
}

OUTPUT:
The output is a confirmation message with the draft ID.
`;

export const GET_MESSAGE_DESCRIPTION = `A tool for retrieving a specific email message from Gmail using its message ID.

INPUT example:
{
  "messageId": "unique_message_id_string"
}

OUTPUT:
The output includes detailed information about the retrieved email message. This includes the subject, body, sender (from), recipients (to), date of the email, and the message ID. If any of these details are not available in the email, the tool will throw an error indicating the missing information.

Example Output:
"Result for the prompt unique_message_id_string
{
  'subject': 'Email Subject',
  'body': 'Email Body Content',
  'from': 'sender@email.com',
  'to': 'recipient@email.com',
  'date': 'Email Date',
  'messageId': 'unique_message_id_string'
}"
`;

export const GET_THREAD_DESCRIPTION = `A tool for retrieving an entire email thread from Gmail using the thread ID.

INPUT example:
{
  "threadId": "unique_thread_id_string"
}

OUTPUT:
The output includes an array of all the messages in the specified thread. Each message in the array contains detailed information including the subject, body, sender (from), recipients (to), date of the email, and the message ID. If any of these details are not available in a message, the tool will throw an error indicating the missing information.

Example Output:
"Result for the prompt unique_thread_id_string
[
  {
    'subject': 'Email Subject',
    'body': 'Email Body Content',
    'from': 'sender@email.com',
    'to': 'recipient@email.com',
    'date': 'Email Date',
    'messageId': 'unique_message_id_string'
  },
  ... (other messages in the thread)
]"
`;

export const SEND_MESSAGE_DESCRIPTION = `A tool for sending an email message using Gmail. It allows users to specify recipients, subject, and the content of the message, along with optional cc and bcc fields.

INPUT example:
{
  "message": "Hello, this is a test email",
  "to": ["recipient1@email.com", "recipient2@email.com"],
  "subject": "Test Email",
  "cc": ["cc1@email.com"],
  "bcc": ["bcc1@email.com"]
}

OUTPUT:
The output is a confirmation message with the ID of the sent email. If there is an error during the sending process, the tool will throw an error with a description of the problem.

Example Output:
"Message sent. Message Id: unique_message_id_string"
`;

export const SEARCH_DESCRIPTION = `A tool for searching email messages or threads in Gmail using a specific query. It offers the flexibility to choose between messages and threads as the search resource.

INPUT example:
{
  "query": "specific search query",
  "maxResults": 10, // Optional: number of results to return
  "resource": "messages" // Optional: can be "messages" or "threads"
}

OUTPUT:
The output is a JSON list of either email messages or threads, depending on the specified resource, that matches the search query. For 'messages', the output includes details like the message ID, thread ID, snippet, body, subject, and sender of each message. For 'threads', it includes the thread ID, snippet, body, subject, and sender of the first message in each thread. If no data is returned, or if the specified resource is invalid, the tool throws an error with a relevant message.

Example Output for 'messages':
"Result for the query 'specific search query':
[
  {
    'id': 'message_id',
    'threadId': 'thread_id',
    'snippet': 'message snippet',
    'body': 'message body',
    'subject': 'message subject',
    'sender': 'sender's email'
  },
  ... (other messages matching the query)
]"

Example Output for 'threads':
"Result for the query 'specific search query':
[
  {
    'id': 'thread_id',
    'snippet': 'thread snippet',
    'body': 'first message body',
    'subject': 'first message subject',
    'sender': 'first message sender'
  },
  ... (other threads matching the query)
]"
`;
