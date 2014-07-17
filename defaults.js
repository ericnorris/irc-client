var defaults = {};

defaults.autoConnect = true;

defaults.nick = 'irc_client';
defaults.user = 'irc_client';

defaults.host = 'localhost';
defaults.port = 6667;

defaults.debug = false;

defaults.extend = function(object) {
    if (typeof object == 'object') {
        Object.keys(object).forEach(function(key) {
            this[key] = object[key];
        }, this);
    }
    return this;
}

module.exports = defaults;