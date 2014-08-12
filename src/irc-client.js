var net       = require('net');
var util      = require('util');
var events    = require('events');

var debug     = require('debug');
var q         = require('q');

var defaults  = require('./defaults');
var ircstream = require('./irc-stream');
var irccodes  = require('./irc-codes')

var client = module.exports = function(options) {
    if (!(this instanceof client)) {
        return new client(options);
    }
    events.EventEmitter.call(this);

    this.options = defaults.extend(options);

    if (this.options.debug) {
        debug.enable('irc-client');
    }

    this._debug = debug('irc-client');
    this._pendingNickChange = null;
    this.serverSupports = {};
    this._joinedChannels = {};
    this._pendingChannels = {};

    this._init();

    if (this.options.autoConnect) {
        this.connect().done();
    }
};
util.inherits(client, events.EventEmitter);

client.prototype._init = function() {
    var self = this;
    function respondToPing(message) {
        self._ircstream.write({command: 'PONG', parameters: message.parameters});
    };

    function checkForRPL_ISUPPORT(message) {
        var parameters = message.parameters;
        var isRPL_ISUPPORT =
            (parameters[parameters.length - 1] == 'are supported by this server');

        if (isRPL_ISUPPORT) {
            var tokens = parameters.slice(1, -1);
            var tokenRegex = /^(-)?(\w+)=?([!-~]+)?/;
            var match;

            for (var i = 0; i < tokens.length; i++) {
                var token = tokens[i];
                if (match = token.match(tokenRegex)) {
                    var negation = match[1]
                    var parameter = match[2];
                    var value = match[3];

                    if (negation) {
                        delete this.serverSupports[parameter];
                    } else if (value) {
                        this.serverSupports[parameter] = value;
                    } else {
                        this.serverSupports[parameter] = true;
                    }
                }
            }
        }
    };

    self.on('PING', respondToPing);
    self.on(irccodes.RPL_BOUNCE, checkForRPL_ISUPPORT);
};

client.prototype.connect = function(callback) {
    var deferred = q.defer();
    var promise = deferred.promise;
    var self = this;

    function onConnect() {
        self._ircstream = ircstream(self._socket);
        self._ircstream.on('readable', emitMessagesOnReadable);

        self._debug('Connected');
        self._emitNextTick('connect');

        deferred.resolve(
            q.all([self.nick(self.options.nick), self.user()]).thenResolve(this)
        );
    };

    function onError(errorObject) {
        deferred.reject(errorObject);
    };

    function emitMessagesOnReadable() {
        var data;
        while ((data = self._ircstream.read()) !== null) {
            self._debug(data.raw);
            self._emitNextTick('message', data);
            self._emitNextTick(data.command, data);
        }
    };

    this._socket = net.connect(this.options);
    this._socket.once('connect', onConnect);
    this._socket.once('error', onError);

    return promise.then(function () {
        self._debug('Registered');
        self._emitNextTick('register');
    }).catch(function(errorObject) {
        self._debug(
            'Error registering with IRC server. Error: \n' + errorObject
        );
    }).finally(function() {
        self._socket.removeListener('connect', onConnect);
        self._socket.removeListener('error', onError);
    }).nodeify(callback);
};

client.prototype.nick = function(nick, callback) {
    var nick = this._trimNick(nick);
    var deferred = q.defer();
    var promise = deferred.promise;
    var nickRetryCount = 1;

    var isSameNick = (this.currentNick == nick);
    if (isSameNick) {
        deferred.resolve(this);
        return promise;
    }

    if (this._pendingNickChange) {
        return this._pendingNickChange.invoke('nick', nick);
    }
    this._pendingNickChange = promise;

    function success(message) {
        var succesfullyChangedNick =
                message.command == 'NICK' &&
                message.nick == this.currentNick;

        var isWelcomeMessage = (message.command == irccodes.RPL_WELCOME);

        if (succesfullyChangedNick || isWelcomeMessage) {
            this.currentNick = message.parameters[0];
            deferred.resolve(this);
        }
    };

    function retryNickChange(message) {
        this._ircstream.write({command: 'NICK', parameters: [nick + nickRetryCount]});
    }

    function error(message) {
        deferred.reject(irccodes[message.command]);
    };

    var successEvents = ['NICK', irccodes.RPL_WELCOME];
    var retryEvents = [irccodes.ERR_NICKNAMEINUSE];
    var errorEvents = [
        irccodes.ERR_NONICKNAMEGIVEN,
        irccodes.ERR_UNAVAILRESOURCE,
        irccodes.ERR_ERRONEUSNICKNAME,
        irccodes.ERR_NICKCOLLISION,
        irccodes.ERR_RESTRICTED
    ];

    this._addListeners(successEvents, success);
    this._addListeners(retryEvents, retryNickChange);
    this._addListeners(errorEvents, error);
    this._ircstream.write({command: 'NICK', parameters: [nick]});

    var self = this;
    return promise.finally(function() {
        self._removeListeners(successEvents, success);
        self._removeListeners(retryEvents, retryNickChange);
        self._removeListeners(errorEvents, error);
        self._pendingNickChange = null;
    }).nodeify(callback);
};

client.prototype.user = function(callback) {
    var deferred = q.defer();
    var promise = deferred.promise;

    function success(message) {
        deferred.resolve(this);
    };

    function error(message) {
        deferred.reject(irccodes[message.command]);
    };

    var successEvents = [irccodes.RPL_WELCOME];
    var errorEvents = [
        irccodes.ERR_NEEDMOREPARAMS,
        irccodes.ERR_ALREADYREGISTRED
    ];

    this._addListeners(successEvents, success);
    this._addListeners(errorEvents, error);
    this._ircstream.write({command: 'USER', parameters:
        [this.options.user, this.options.mode, '*', this.options.realName]
    });

    var self = this;
    return promise.finally(function() {
        self._removeListeners(successEvents, success);
        self._removeListeners(errorEvents, error);
    }).nodeify(callback);
};

client.prototype.join = function(channel, callback) {
    var channel = this._trimChannel(channel);
    var deferred = q.defer();
    var promise = deferred.promise;
    var self = this;

    var inChannel = this._joinedChannels[channel] ? true : false;
    if (inChannel) {
        deferred.resolve(this);
        return promise;
    }

    var joiningChannel = this._pendingChannels[channel] ? true : false;
    if (joiningChannel) {
        return this._pendingChannels[channel];
    } else {
        this._pendingChannels[channel] = promise;
    }

    function success(message) {
        var joinedDesiredChannel =
                message.nick == this.currentNick &&
                message.parameters[0] == channel;

        if (joinedDesiredChannel) {
            self._joinedChannels[channel] = true;
            deferred.resolve(this);
        }
    };

    function error(message) {
        var messageIsRelevant =
                message.parameters[0] == this.currentNick &&
                message.parameters[1] == channel;

        if (messageIsRelevant) {
            deferred.reject(irccodes[message.command]);
        }
    };

    var successEvents = ['JOIN'];
    var errorEvents = [
        irccodes.ERR_NEEDMOREPARAMS,
        irccodes.ERR_BANNEDFROMCHAN,
        irccodes.ERR_INVITEONLYCHAN,
        irccodes.ERR_BADCHANNELKEY,
        irccodes.ERR_CHANNELISFULL,
        irccodes.ERR_BADCHANMASK,
        irccodes.ERR_NOSUCHCHANNEL,
        irccodes.ERR_TOOMANYCHANNELS,
        irccodes.ERR_TOOMANYTARGETS,
        irccodes.ERR_UNAVAILRESOURCE
    ];

    this._addListeners(successEvents, success);
    this._addListeners(errorEvents, error);
    this._ircstream.write({command: 'JOIN', parameters: [channel]});

    return promise.finally(function() {
        self._pendingChannels[channel] = null;
        self._removeListeners(successEvents, success);
        self._removeListeners(errorEvents, error);
    }).nodeify(callback);
};

client.prototype.part = function(channel, message, callback) {
    var channel = this._trimChannel(channel);
    var message = message ? message : '';
    var deferred = q.defer();
    var promise = deferred.promise;
    var self = this;

    function success(message) {
        var succesfullyParted = 
                message.nick = this.currentNick &&
                message.parameters[0] == channel;

        if (succesfullyParted) {
            self._joinedChannels[channel] = false;
            deferred.resolve(self);
        }
    };

    function error(message) {
        var messageIsRelevant =
                message.parameters[0] == this.currentNick &&
                message.parameters[1] == channel;

        if (messageIsRelevant) {
            deferred.reject(irccodes[message.command]);
        }
    };

    var successEvents = ['PART'];
    var errorEvents = [
        irccodes.ERR_NEEDMOREPARAMS,
        irccodes.ERR_NOSUCHCHANNEL,
        irccodes.ERR_NOTONCHANNEL
    ];

    this._addListeners(successEvents, success);
    this._addListeners(errorEvents, error);
    this._ircstream.write({command: 'PART', parameters: [channel, message]});

    return promise.finally(function() {
        self._removeListeners(successEvents, success);
        self._removeListeners(errorEvents, error);
    }).nodeify(callback);
};

client.prototype.privmsg = function(target, message) {
    this._ircstream.write({command: 'PRIVMSG', parameters: [target, message]});
    return this;
};

client.prototype.whois = function(nick, callback) {
    var deferred = q.defer();
    var promise = deferred.promise;
    var whoisResult = {
        nick: nick,
        channels: [],
        operatorChannels: [],
        moderatedChannels: []
    };
    var self = this;

    function messageIsRelevant(message) {
        return (message.parameters[0] == self.currentNick &&
                message.parameters[1] == nick);
    }

    function bufferWhoisData(message) {
        if (!messageIsRelevant(message)) {
            return;
        }

        switch (message.command) {
            case irccodes.RPL_AWAY:
                whoisResult.away = message.parameters[2];
            case irccodes.RPL_WHOISUSER:
                whoisResult.user = message.parameters[2];
                whoisResult.host = message.parameters[3];
                whoisResult.realName = message.parameters[5];
                break;
            case irccodes.RPL_WHOISSERVER:
                whoisResult.server = message.parameters[2];
                whoisResult.serverInfo = message.parameters[3];
                break;
            case irccodes.RPL_WHOISOPERATOR:
                whoisResult.operator = true;
                break;
            case irccodes.RPL_WHOISIDLE:
                whoisResult.idleTime = message.parameters[2];
                break;
            case irccodes.RPL_WHOISCHANNELS:
                var channelList = message.parameters[2].split(' ').filter(String);

                for (var i = 0; i < channelList.length; i++) {
                    var channel = channelList[i];
                    if (channel.charAt(0) == '@') {
                        channel = channel.slice(1);
                        whoisResult.operatorChannels.push(channel);
                    } else if (channel.charAt(0) == '+') {
                        channel = channel.slice(1);
                        whoisResult.moderatedChannels.push(channel);
                    }

                    whoisResult.channels.push(channel);
                }
                break;
            default:
                // ignore
                break;
        }
    };

    function success(message) {
        if (messageIsRelevant(message)) {
            deferred.resolve(whoisResult);
        }
    };

    function error(message) {
        if (messageIsRelevant(message)) {
            deferred.reject(irccodes[message.command]);
        }
    };

    var bufferEvents = [
        irccodes.RPL_AWAY,
        irccodes.RPL_WHOISUSER,
        irccodes.RPL_WHOISSERVER,
        irccodes.RPL_WHOISOPERATOR,
        irccodes.RPL_WHOISIDLE,
        irccodes.RPL_WHOISCHANNELS
    ];
    var successEvents = [irccodes.RPL_ENDOFWHOIS];
    var errorEvents = [
        irccodes.ERR_NOSUCHSERVER,
        irccodes.ERR_NONICKNAMEGIVEN,
        irccodes.ERR_NOSUCHNICK
    ];

    this._addListeners(bufferEvents, bufferWhoisData);
    this._addListeners(successEvents, success);
    this._addListeners(errorEvents, error);
    this._ircstream.write({command: 'WHOIS', parameters: [nick]});

    return promise.finally(function() {
        self._removeListeners(bufferEvents, bufferWhoisData);
        self._removeListeners(successEvents, success);
        self._removeListeners(errorEvents, error);
    }).nodeify(callback);
};

client.prototype.quit = function(quitMessage) {
    var quitMessage = quitMessage ? quitMessage : this.options.quitMessage;

    this._ircstream.write({command: 'QUIT', parameters: [quitMessage]});
};

client.prototype._emitNextTick = function() {
    var self = this;
    var emitArgs = Array.prototype.slice.call(arguments);

    process.nextTick(function() {
        self.emit.apply(self, emitArgs);
    });
};

client.prototype._trimNick = function(nick) {
    var maxNickLength = this.serverSupports['NICKLEN'] |
                        this.options.maxNickLength;

    return nick.slice(0, maxNickLength);
};

client.prototype._trimChannel = function(channel) {
    var maxChannelLength = this.serverSupports['CHANNELLEN'] |
                           this.options.maxChannelLength;

    return channel.slice(0, maxChannelLength)
};

client.prototype._addListeners = function(events, callback) {
    for (var i = 0; i < events.length; i++) {
        this.addListener(events[i], callback);
    }
};

client.prototype._removeListeners = function(events, callback) {
    for (var i = 0; i < events.length; i++) {
        this.removeListener(events[i], callback);
    }
};
