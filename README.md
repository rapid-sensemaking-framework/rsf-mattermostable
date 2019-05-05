# rsf-mattermostable

A class that can send and receive [mattermost](https://mattermost.com/) messages,
that has a clean and simple speak/listen API.

You will need to set up an account on a particular server that will act as the proxy...
then just contact the rsf-runner admin and give them the email address and password for that bot user

## Installation
`npm install --save rsf-mattermostable`

## environment variables

- `MATTERMOST_BOT_DETAILS`  : `String`, should look like https://chat.server.url.org@@chatbotemail@whatever.com@@chatbotpassword@@@...

## Formatting of `id`

The `id` property of a person config should be like the following:

`username@https://chat.server.url.org`

## Associated `type` configuration

In a person config, use type `mattermost` to specify a `Mattermostable`

## Mattermostable Persno Config Example

```json
{
  "type": "mattermost",
  "id": "philip123@https://chat.server.url.org
}
```

## API

__`Mattermostable`__

`constructor(id, name)`: A Mattermostable is a wrapped version of a bidirectional communication channel between the program, and a person, in which messages of text/strings can be sent and received

`id`: `String`, the phone number to reach this person at

`name`: `String`, optional, a name of the person being contacted

### __Instance methods__
___

`speak(string)`: Contact the person represented by the Mattermostable, sending them a message

`string`: `String`, the string of text to send the person represented

___

`listen(callback)`: Handle a message from the person represented by the Mattermostable, received as a simple string

`callback(string)`: `Function`, give a function which will be called whenever a message from the person is received
