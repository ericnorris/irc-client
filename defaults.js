var defaults = {};

defaults.autoConnect = true;

defaults.nick = 'irc_client';
defaults.user = 'irc_client';
defaults.mode = 8;
defaults.realName = 'irc_client';

defaults.host = 'localhost';
defaults.port = 6667;

defaults.debug = false;

defaults.maxNickLength = 9;

defaults.extend = function(object) {
    if (typeof object == 'object') {
        Object.keys(object).forEach(function(key) {
            this[key] = object[key];
        }, this);
    }
    return this;
}

module.exports = defaults;