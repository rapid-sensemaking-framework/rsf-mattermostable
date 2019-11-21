const EventEmitter = require('events') // nodejs native import
const { findOrCreateClients } = require('./mattermostClients')

// this key will be also used by other classes that implement the "Contactable"
// trait/contract
const STANDARD_EVENT_KEY = 'msg'
module.exports.STANDARD_EVENT_KEY = STANDARD_EVENT_KEY

// export a var which will be used to determine whether to use Mattermostable
// as their mode of contact
const TYPE_KEY = 'mattermost'
module.exports.TYPE_KEY = TYPE_KEY

let mattermostBots = {}
const init = (servers) => {
    console.log('initializing rsf-mattermostable')
    servers.split("@@@").forEach(server => {
        const [url, email, password] = server.split("@@")
        // cache the promises so that
        // we only end up with a single client per server
        // so that we can effectively rate limit the messages
        mattermostBots[url] = findOrCreateClients(url, email, password)
    })
    const promises = Object.keys(mattermostBots).map(key => mattermostBots[key])
    return Promise.all(promises)
}
module.exports.init = init

const shutdown = async () => {
    console.log('shutting down rsf-mattermostable')
    // shutdown mattermost bots
    const promises = Object.keys(mattermostBots).map(async mattermostServerUrl => {
        const { wsClient } = await getClients(mattermostServerUrl)
        console.log('closing ws connection to ' + mattermostServerUrl)
        wsClient.close(true) // true for DONT RECONNECT
    })
    return Promise.all(promises).then(() => {
        mattermostBots = {}
    })
}
module.exports.shutdown = shutdown

const getClients = (mattermostServerUrl) => {
    return mattermostBots[mattermostServerUrl]
}

const setupChannelAndGetId = async (username, webClient, botId) => {
    // open a channel for sending messages
    const profiles = await webClient.getProfilesByUsernames([username])
    const userId = profiles[0].id
    const dm = await webClient.createDirectChannel([botId, userId])
    return dm.id
}

const setupChannelAndCallbacks = async (mattermostAble) => {
    // username@https://some.chat.server.org
    const [username, mattermostServerUrl] = mattermostAble.id.split('@')
    const { webClient, wsClient, botId } = await getClients(mattermostServerUrl)
    const channelId = await setupChannelAndGetId(username, webClient, botId)

    // keep whatever the callback was before
    // make sure that it still fires
    const oldCallback = wsClient.eventCallback || (() => { })
    // forward messages from the websocket connection
    // over the class/instance level event emitter
    wsClient.setEventCallback(event => {
        oldCallback(event)

        // filter out weird null events
        // and events that aren't posts
        // and events that aren't in the DM with this user
        if (!event ||
            event.event !== 'posted' ||
            event.broadcast.channel_id !== channelId) return

        const post = JSON.parse(event.data.post)

        // also filter for messages the bot sends
        if (post.user_id === botId) return

        // Otherwise, emit an event that conforms to the standard for Contactable
        mattermostAble.emit(STANDARD_EVENT_KEY, post.message)
    })
}

class Mattermostable extends EventEmitter {
    constructor(id, name) {
        super()

        // username@https://some.chat.server.org
        this.id = id
        // a human name, optional
        this.name = name

        setupChannelAndCallbacks(this)
    }

    // expose a function that conforms to the standard for Contactable
    // which can "reach" the person
    async speak(string) {
        const [username, mattermostServerUrl] = this.id.split('@')
        const { webClient, botId } = await getClients(mattermostServerUrl)
        const channelId = await setupChannelAndGetId(username, webClient, botId)
        webClient.createPost({ message: string, channel_id: channelId })
    }

    listen(callback) {
        // just set up the actual event listener
        // using the appropriate key,
        // but not bothering to expose it
        this.on(STANDARD_EVENT_KEY, callback)
    }

    stopListening() {
        this.removeAllListeners()
    }

    config() {
      return {
        type: TYPE_KEY,
        id: this.id,
        name: this.name
      }
    }
}
module.exports.Mattermostable = Mattermostable

