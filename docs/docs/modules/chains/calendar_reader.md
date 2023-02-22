# Google Calendar Reader Chain

A Google Calendar Reader chain takes as input a question, and then pulls recent primary calendar events and uses them as evidence for the question response.

You'll need an authenticated Google API client with access to the `calendar.readonly` scope, to pass into the `ReadGoogleCalendar` tool instance.

## Example

The following is about the example in `examples/src/chains/calendar_chain.ts`.

To obtain the authenticated client in the example, we use the `@google-cloud/local-auth` library. Using a "desktop app" credentials file obtained with [these instructions](https://developers.google.com/calendar/api/quickstart/nodejs#authorize_credentials_for_a_desktop_application), pass the path to the secret keyfile as an environment variable `GOOGLE_KEYFILE_PATH` when running the example.

The chain also doesn't know the current date by default. See the example for a working way to imbue this:

```ts
`Today's ${new Date().toString()}. What events do I have in the coming month?`;
```
