var util       = require('util');

var duplex     = require('readable-stream').Duplex;
var split      = require('split2');

var ircmessage = require('./irc-message');

var ircstream = module.exports = function(stream) {
    if (!(this instanceof ircstream)) {
        return new ircstream(stream);
    }

    duplex.call(this, {objectMode: true});

    this._readable = stream.pipe(split());
    this._writable = stream;
    this._readRequested = false;

    var self = this;

    this._writable.once('finish', function() {
        self.end();
    });

    this.once('finish', function() {
        self._writable.end();
    });

    self._readable.on('readable', function() {
        self._forwardRead();
    });

    self._readable.once('end', function() {
        self.push(null);
    });

    self._writable.on('error', function(error) {
        self.emit('error', error);
    });

    self._readable.on('error', function(error) {
        self.emit('error', error);
    });
}
util.inherits(ircstream, duplex);

ircstream.prototype._write = function(object, encoding, callback) {
    this._writable.write(ircmessage(object), callback);
};

ircstream.prototype._read = function() {
    if (!this._readRequested) {
        this._readRequested = true;
    }
};

ircstream.prototype._forwardRead = function() {
    if (this._readRequested) {
        var data;

        while ((data = this._readable.read()) !== null) {
            this._readRequested = false
            this.push(ircmessage(data));
        }
    }
};
