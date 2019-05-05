require('babel-polyfill')
require('isomorphic-fetch')
if (!global.WebSocket) {
    global.WebSocket = require('ws')
}
const Client4 = require('mattermost-redux/client/client4').default
const WsClient = require('mattermost-redux/client/websocket_client').default
const url = require('url')

// we only need, and should have, one bot per mattermost server
// so keep track of them in memory
const mattermostBots = {}

const findOrCreateClients = async (mattermostServerUrl, botEmail, botPassword) => {

    if (mattermostBots[mattermostServerUrl]) {
        return mattermostBots[mattermostServerUrl]
    }

    const webClient = new Client4()
    webClient.setUrl(mattermostServerUrl)
    
    // "login" to the bot with the webClient
    let { id } = await webClient.login(botEmail, botPassword)
    let token = webClient.getToken()
    
    // with the token, open a websocket connection
    const wsClient = new WsClient()
    wsClient
        .initialize(token, {}, {}, { connectionUrl: `wss://${url.parse(mattermostServerUrl).host}/api/v4/websocket` })
        .catch((err) => console.log('error connecting to mattermost', err))

    const clients = {
        wsClient,
        webClient,
        botId: id
    }

    mattermostBots[mattermostServerUrl] = clients

    return clients
}
module.exports.findOrCreateClients = findOrCreateClients
