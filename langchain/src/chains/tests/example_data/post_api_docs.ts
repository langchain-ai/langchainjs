export const POST_API_DOCS = `
Endpoint:  https://httpbin.org

This API Sends a message to a channel.
Method: POST

POST /post

POST Body:
token | string | Authentication token bearing required scopes| required
channel | string | Channel, private group, or IM channel to send message to. Can be an encoded ID, or a name. See below for more details. | required
text | string | text is the message you want to send in a channel
`;
