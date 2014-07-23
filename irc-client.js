var net = require('net');
var util = require('util');
var events = require('events');
var debug = require('debug');
var q = require('q');
var defaults = require('./defaults');
var ircstream = require('./irc-stream');
var irccodes = require('./irc-codes')

var client = module.exports = function(options) {
    if (!(this instanceof client)) {
        return new client(options);
    }
    events.EventEmitter.call(this);

    this.options = defaults.extend(options);
    this.currentNick = this.options.nick;

    if (this.options.autoConnect) {
        this.connect();
    }

    if (this.options.debug) {
        debug.enable('irc-client');

        this.on('message', function(message) {
            this._debug(message.raw);
        });
    }
    this._debug = debug('irc-client');
};
util.inherits(client, events.EventEmitter);

client.prototype.connect = function() {
    var deferred = q.defer();
    var promise = deferred.promise;
    var self = this;

    function onConnect() {
        self._ircstream = ircstream(self._socket);
        self._ircstream.on('readable', emitMessagesOnReadable);

        self.on('PING', respondToPing);

        self._debug('Connected');
        self.emit('connect');

        deferred.resolve(
            q.all([self.nick(self.currentNick), self._user()])
        );
    };

    function onError(errorObject) {
        deferred.reject(errorObject);
    };

    function emitMessagesOnReadable() {
        var data;
        while ((data = self._ircstream.read()) !== null) {
            self.emit('message', data);
            self.emit(data.command, data);
        }
    };

    function respondToPing(message) {
        this._ircstream.write({command: 'PONG', parameters: message.parameters});
    };

    this._socket = net.connect(this.options);
    this._socket.once('connect', onConnect);
    this._socket.once('error', onError);

    return promise.then(function () {
        self._debug('Registered');
        self.emit('register');
    }).catch(function(errorObject) {
        self._debug(
            'Error registering with IRC server. Error: \n' + errorObject
        );
    }).finally(function() {
        self._socket.removeListener('connect', onConnect);
        self._socket.removeListener('error', onError);
    });
};

client.prototype.nick = function(nick) {
    // TODO: same-nick check

    var deferred = q.defer();
    var promise = deferred.promise;
    var nickRetryCount = 1;

    function success(message) {
        if (message.command == 'NICK' && message.nickname != this.currentNick) {
            return;
        }

        this.currentNick = message.parameters.shift();
        deferred.resolve();
    };

    function error(message) {
        if (message.command == irccodes.ERR_NICKNAMEINUSE) {
            this._ircstream.write({command: 'NICK', parameters:[nick + nickRetryCount]});
        } else {
            deferred.reject(irccodes[message.command]);
        }
    };

    var successEvents = ['NICK', irccodes.RPL_WELCOME];
    var errorEvents = [
        irccodes.ERR_NONICKNAMEGIVEN,
        irccodes.ERR_NICKNAMEINUSE,
        irccodes.ERR_UNAVAILRESOURCE,
        irccodes.ERR_ERRONEUSNICKNAME,
        irccodes.ERR_NICKCOLLISION,
        irccodes.ERR_RESTRICTED
    ];

    this._addListeners(successEvents, success);
    this._addListeners(errorEvents, error);
    this._ircstream.write({command: 'NICK', parameters: [nick]});

    var self = this;
    return promise.finally(function() {
        self._removeListeners(successEvents, success);
        self._removeListeners(errorEvents, error);
    });
};

client.prototype.join = function(channel) {
    var deferred = q.defer();
    var promise = deferred.promise;

    function success(message) {
        var joinedDesiredChannel =
                message.nickname == this.currentNick &&
                message.parameters.shift() == channel;

        if (joinedDesiredChannel) {
            deferred.resolve();
        }
    };

    function error(message) {
        deferred.reject(irccodes[message.command]);
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

    var self = this;
    return promise.finally(function() {
        self._removeListeners(successEvents, success);
        self._removeListeners(errorEvents, error);
    });
};

client.prototype._user = function() {
    var deferred = q.defer();
    var promise = deferred.promise;

    function success(message) {
        deferred.resolve();
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
    });
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
