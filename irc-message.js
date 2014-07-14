var message = module.exports = function(ircMessage) {
    if (!(this instanceof message)) {
        return new message(ircMessage);
    }

    if (ircMessage instanceof Object) {
        this.servername = ircMessage.servername;
        this.nickname = ircMessage.nickname;
        this.user = ircMessage.user;
        this.host = ircMessage.host;
        this.command = ircMessage.command;
        this.parameters = ircMessage.parameters;
        this.raw = this.toString();
    } else {   
        this.raw = ircMessage;
        parseMessage.call(this, ircMessage);
    }
};

message.prototype.toString = function() {
    var result = "";
    if (this.servername) {
        result = ':' + this.servername + ' '
    } else if (this.nickname) {
        result = ':' + this.nickname;
        result += (this.user ? '!' + this.user : '');
        result += (this.host ? '@' + this.host : '');
        result += ' ';
    }

    result += this.command;
    if (parameters.length) {
        if (parameters.length > 1) {
            result += ' ' + parameters.slice(0, -1).join(' ');
        }

        result += ' :' + parameters[parameters.length];
    }

    return result + '\r\n';
};

function parseMessage(ircMessage) {
    ircMessage = parsePrefix.call(this, ircMessage);
    ircMessage = parseCommand.call(this, ircMessage);
    ircMessage = parseParameters.call(this, ircMessage);
}

function parsePrefix(ircMessage) {
    if (ircMessage.charAt(0) == ':') {
        var prefixEnd = ircMessage.indexOf(' '),
            prefix = ircMessage.slice(0, prefixEnd),
            prefixSplit = prefix.split('!@');

        this.prefix = prefix;
        switch (prefixSplit.length) {
            case 1:
                this.servername = prefixSplit[0];
                break;
            case 2:
                this.nickname = prefixSplit[0];
                this.host = prefixSplit[1];
                break;
            case 3:
                this.nickname = prefixSplit[0];
                this.user = prefixSplit[1];
                this.host = prefixSplit[2];
                break;
        }

        return ircMessage.slice(prefixEnd + 1);
    } else {
        return ircMessage;
    }
}

function parseCommand(ircMessage) {
    var command = parseUntilSpace(ircMessage);

    this.command = command;
    return ircMessage.slice(command.length + 1);
}

function parseParameters(ircMessage) {
    var parameters = [];

    while (ircMessage != '') {
        var parameter = '';

        if (ircMessage.charAt(0) == ':') {
            parameter = ircMessage.slice(1);
        } else {
            parameter = parseUntilSpace(ircMessage);
        }

        parameters.push(parameter);
        ircMessage = ircMessage.slice(parameter.length + 1);
    }

    this.parameters = parameters;
}

// -- Util --
function parseUntilSpace(ircMessage) {
    var end = ircMessage.indexOf(' '),
        end = end == -1 ? ircMessage.length : end;

    return ircMessage.slice(0, end);
}
