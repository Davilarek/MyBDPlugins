/**
 * @name FirstMessage
 * @version 0.1
 * @author Davilarek
 * @description Port of Aliucord plugin
*/
/* global BdApi */
module.exports = class FirstMessagePlugin {
    constructor() {
        this.commandName = "FirstMessage";
        this.commandNamePrefix = "/";
        this.RestAPI = BdApi.Webpack.getModule(x => x.getAPIBaseURL);
        /**
         * @type {Function}
         */
        this.getChannelById = BdApi.Webpack.getModule(x => x.getChannel && x.getDMUserIds).getChannel;
        /**
         * @type {Function}
         */
        this.getCurrentChannelId = BdApi.Webpack.getModule(x => x.getChannelId && x.getCurrentlySelectedChannelId).getCurrentlySelectedChannelId;
    }
    start() {
        const sendMessage = BdApi.Webpack.getModule(x => x.sendMessage);
        this.patch = BdApi.Patcher.instead("FirstMessage", sendMessage, "sendMessage", (_, args, orig) => {
            const [channelId, message] = args;
            /**
             * @type {{content: String}}
             */
            const { content } = message;
            if (content.startsWith((this.commandNamePrefix + this.commandName).toLowerCase())) {
                const tellTheUser = x => sendMessage.sendBotMessage(channelId, x.toString());
                const rawOptions = content.slice((this.commandNamePrefix + this.commandName).length + 1);
                /**
                 * @type {Object.<string, string>}
                 */
                const parsedOptions = {};
                if (rawOptions.length > 0) {
                    // rawOptions.split(" ").map(x => x.split(":")).forEach(x => parsedOptions[x[0]] = x[1]);
                    rawOptions.split(/\s+(?=\S+:)/).map(x => x.split(":")).forEach(x => parsedOptions[x[0]] = x[1].trimStart());

                    Object.keys(parsedOptions).forEach(x => parsedOptions[x].startsWith("<") && parsedOptions[x].endsWith(">") ? parsedOptions[x] = parsedOptions[x].slice(2).slice(0, -1) : parsedOptions[x] = undefined);
                    if (Object.values(parsedOptions).filter(x => typeof x === 'undefined').length > 0) {
                        tellTheUser(`Usage: ${this.commandNamePrefix + this.commandName} user:<user mention> channel:<channel mention>\n(options that have "<>" after ":" are optional)`);
                        return;
                    }
                }
                this.processAction(parsedOptions).then(tellTheUser, tellTheUser);
            }
            else
                return orig(...args);
        });
    }
    stop() {
        this.patch();
    }
    /**
     * @param {Object} options
     * @param {string} options.user
     * @param {string} options.channel
     */
    async processAction(options) {
        const { channel, user } = options;
        // const channelObj = this.getChannelById(channel);
        const channelObj = this.getChannelById(this.getCurrentChannelId());
        const localChannelId = channelObj.id;
        const base = `https://discord.com/channels/`;
        if (channel && user) {
            // const channelObj = this.getChannelById(channel);
            // const channelObj = this.getChannelById(this.getCurrentChannelId());
            if (channelObj && (channelObj.type == 1 || channelObj.type == 3)) {
                throw new Error(`This combination cannot be used in dms!`);
            }
            const result = await this.getFirstMessage('guild', { channelId: channel, guildId: channelObj["guild_id"] }, user);
            if (!result)
                throw new Error(`This user has not sent a message!`);
            return `${base}${channelObj["guild_id"]}/${channel}/${Object.values(result)[0]}`;
        }

        if (channel) {
            // const channelObj = this.getChannelById(channel);
            // const channelObj = this.getChannelById(this.getCurrentChannelId());
            if (channelObj && (channelObj.type == 1 || channelObj.type == 3)) {
                throw new Error(`This combination cannot be used in dms!`);
            }
            const result = await this.getFirstMessage('guild', { guildId: channelObj["guild_id"], channelId: channel }, undefined, 0);
            if (!result)
                throw new Error(`This user has not sent a message!`);
            return `${base}${channelObj["guild_id"]}/${channel}/${Object.values(result)[0]}`;
        }

        if (user) {
            // const channelObj = this.getChannelById(this.getCurrentChannelId());
            if (channelObj && (channelObj.type == 1 || channelObj.type == 3)) {
                const result = await this.getFirstMessage('channel', { channelId: localChannelId }, user);
                if (!result)
                    throw new Error(`This user has not sent a message!`);
                return `${base}@me/${localChannelId}/${result}`;
            }
            const result = await this.getFirstMessage('guild', { guildId: channelObj["guild_id"], channelId: localChannelId }, user);
            if (!result)
                throw new Error(`This user has not sent a message!`);
            return `${base}${channelObj["guild_id"]}/${localChannelId}/${Object.values(result)[0]}`;
        }

        // const channelObj = this.getChannelById(this.getCurrentChannelId());
        if (channelObj && (channelObj.type == 1 || channelObj.type == 3)) {
            const result = await this.getFirstMessage('channel', { channelId: localChannelId }, undefined, 0);
            if (!result)
                throw new Error(`This user has not sent a message!`);
            return `${base}@me/${localChannelId}/${result}`;
        }

        const result = await this.getFirstMessage('guild', { guildId: channelObj["guild_id"] }, undefined, 0);
        if (!result)
            throw new Error(`This user has not sent a message!`);
        return `${base}${channelObj["guild_id"]}/${Object.keys(result)[0]}/${Object.values(result)[0]}`;
    }
    /**
     * @param {"guild" | "channel"} type We dealing with guild or channel only?
     * @param {Object} channelOrGuildId
     * @param {string | null} channelOrGuildId.guildId
     * @param {string} channelOrGuildId.channelId
     * @param {string | null} userId First message of a certain user
     * @param {string | null} minId
     * @returns {Promise<string | Object.<string, string>>}
     */
    async getFirstMessage(type, channelOrGuildId, userId = null, minId = null) {
        if (channelOrGuildId.guildId == undefined)
            channelOrGuildId.guildId = null;
        const query = {
            include_nsfw: "true",
            sort_by: "timestamp",
            sort_order: "asc",
            offset: "0",
        };
        if (userId != null) {
            query["author_id"] = userId;
        }
        if (minId != null) {
            query["min_id"] = minId;
        }
        if (channelOrGuildId.guildId != null && channelOrGuildId.channelId != null) {
            query["channel_id"] = channelOrGuildId.channelId;
        }
        const { body, ok } = await this.RestAPI.get({
            url: "/" + type + "s/" + (channelOrGuildId.guildId ? channelOrGuildId.guildId : channelOrGuildId.channelId) + "/messages/search",
            query,
            oldFormErrors: true,
        });
        if (ok) {
            if (channelOrGuildId.guildId == null)
                return body.messages[0][0].id;
            else
                return { [body.messages[0][0]["channel_id"]]: body.messages[0][0].id };
        }
        else
            return null;
    }
};
