var defaults = {};

defaults.autoConnect = true;

defaults.nick = 'ircclient';
defaults.user = 'ircclient';
defaults.mode = 8;
defaults.realName = 'irc client';

defaults.host = 'localhost';
defaults.port = 6667;

defaults.debug = false;

defaults.maxNickLength = 9;
defaults.maxChannelLength = 50;

defaults.quitMessage = 'tidal waves of emotion';

defaults.extend = function(object) {
    if (typeof object == 'object') {
        Object.keys(object).forEach(function(key) {
            this[key] = object[key];
        }, this);
    }
    return this;
}

module.exports = defaults;