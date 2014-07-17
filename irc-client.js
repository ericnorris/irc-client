var net = require('net');
var util = require('util');
var events = require('events');
var debug = require('debug');
var defaults = require('./defaults');
var ircstream = require('./irc-stream');

var client = module.exports = function(options) {
    if (!(this instanceof client)) {
        return new client(options);
    }
    events.EventEmitter.call(this);

    this.options = defaults.extend(options);
    this.nick = this.options.nick;

    if (this.options.autoConnect) {
        console.log(this);
        this.connect();
    }

    if (this.options.debug) {
        debug.enable('irc-client');
        this.debug = debug('irc-client');

        this.on('message', function(message) {
            this.debug(message.raw);
        });
    }
};
util.inherits(client, events.EventEmitter);

client.prototype.connect = function() {
    var self = this;

    this._socket = net.connect(this.options, function() {
        self._ircstream = ircstream(self._socket);

        self._ircstream.on('readable', function(data) {
            var data;
            while ((data = self._ircstream.read()) !== null) {
                self.emit('message', data);
                self.emit(data.command, data);
            }
        });
    });
};
