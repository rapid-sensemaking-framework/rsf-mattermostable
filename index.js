const EventEmitter = require('events') // nodejs native import

const trickle = require('timetrickle')
const { findOrCreateClients } = require('./mattermostClients')

// this key will be also used by other classes that implement the "Contactable"
// trait/contract
const STANDARD_EVENT_KEY = 'msg'
module.exports.STANDARD_EVENT_KEY = STANDARD_EVENT_KEY

// export a var which will be used to determine whether to use Mattermostable
// as their mode of contact
const TYPE_KEY = 'mattermost'
module.exports.TYPE_KEY = TYPE_KEY

let botDetails = ''
module.exports.setBotDetails = (details) => {
    botDetails = details
}

const getDetailsForServer = (mattermostServerUrl) => {
    const server = botDetails.split("@@@").find(s => s.indexOf(mattermostServerUrl === 0))
    const [url, email, password] = server.split("@@")
    return { email, password }
}

// cache the promises so that
// we only end up with a single client per server
// so that we can effectively rate limit the messages
const mattermostBots = {}
const getClients = (mattermostServerUrl) => {

    if (mattermostBots[mattermostServerUrl]) {
        return mattermostBots[mattermostServerUrl]
    }

    // get details from the environment variable
    // for the specific chat server they're on
    // assuming they exist
    const { email, password } = getDetailsForServer(mattermostServerUrl)
    mattermostBots[mattermostServerUrl] = findOrCreateClients(mattermostServerUrl, email, password).then(clients => {
        // limit to a max of 1 message per second
        const limit = trickle(1, 1000)
        clients.webClient.createPostTrickle = (data) => {
            limit(() => {
                clients.webClient.createPost(data)
            })
        }
        return clients
    })
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
        webClient.createPostTrickle({ message: string, channel_id: channelId })
    }

    listen(callback) {
        // just set up the actual event listener
        // using the appropriate key,
        // but not bothering to expose it
        this.on(STANDARD_EVENT_KEY, callback)
    }
}
module.exports.Mattermostable = Mattermostable

