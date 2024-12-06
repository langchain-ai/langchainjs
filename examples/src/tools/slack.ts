import {
  SlackGetChannelsTool,
  SlackGetMessagesTool,
  SlackScheduleMessageTool,
  SlackPostMessageTool,
} from "@langchain/community/tools/slack";

// Get messages given a query
const getMessageTool = new SlackGetMessagesTool();
const messageResults = await getMessageTool.invoke("Hi");
console.log(messageResults);

// Get information about Slack channels
const getChannelTool = new SlackGetChannelsTool();
const channelResults = await getChannelTool.invoke("");
console.log(channelResults);

// Schedule a slack message given a message, channel and time
const scheduleMessageTool = new SlackScheduleMessageTool();
const scheduleResults = await scheduleMessageTool.invoke(
  JSON.stringify({
    text: "Test",
    channel_id: "C1234567890",
    post_at: "2024-12-09T10:30:00+03:00",
  })
);
console.log(scheduleResults);

// Post a message to a given channel
const postMessageTool = new SlackPostMessageTool();
const postResult = await postMessageTool.invoke(
  JSON.stringify({
    text: "Test",
    channel_id: "C1234567890",
  })
);
console.log(postResult);
