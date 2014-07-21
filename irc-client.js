var net = require('net');
var util = require('util');
var events = require('events');
var debug = require('debug');
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
    var self = this;

    this._socket = net.connect(this.options, function() {
        self._ircstream = ircstream(self._socket);
        self._ircstream.on('readable', emitMessagesOnReadable);

        self.on('PING', respondToPing);

        self._debug('Connected');
        self.emit('connect');

        self.nick(self.currentNick);
        self._user();
    });

    function emitMessagesOnReadable() {
        var data;
        while ((data = self._ircstream.read()) !== null) {
            self.emit('message', data);
            self.emit(data.command, data);
        }
    }

    function respondToPing(message) {
        this._ircstream.write({command: 'PONG', parameters: message.parameters});
    }
};

client.prototype.nick = function(nick) {
    this._until(['NICK', irccodes.RPL_WELCOME], function(message) {
        if ((message.command == irccodes.RPL_WELCOME) || 
            (message.command == 'NICK' && message.nickname == this.currentNick)) {
            var actualNick = message.parameters.shift();

            this.currentNick = actualNick ? actualNick : this.currentNick;
            return true;
        }

        return false;
    });

    this._ircstream.write({command: 'NICK', parameters: [nick]});
    
};

client.prototype.join = function(channel) {
    this._until(['JOIN'], function(message) {
        if (message.command == 'JOIN' && message.nickname == this.currentNick) {
            this._debug('joined ' + channel);

            return true;
        }
    });

    this._ircstream.write({command: 'JOIN', parameters: [channel]});
};

client.prototype._user = function() {
    this._until([irccodes.RPL_WELCOME], function(message) {
        // should listen for errors as well
        this.emit('register');
        this._debug('registered');
        return true;
    });

    this._ircstream.write({command: 'USER', parameters: ['test', 8, '*', 'test']});
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

client.prototype._until = function(events, callback) {
    this._addListeners(events, function testCallback(data) {
        var shouldStopListening = callback.call(this, data);
        if (shouldStopListening) {
            this._removeListeners(events, testCallback);
        }
    });
}
