var ircmessage = module.exports = function(objectOrString) {
    if (objectOrString instanceof Object) {
        return messageToString(objectOrString)
    } else {
        return stringToMessage(objectOrString);
    }
};

function messageToString(object) {
    var result = "";
    if (object.servername) {
        result = ':' + object.servername + ' '
    } else if (object.nickname) {
        result = ':' + object.nickname;
        result += (object.user ? '!' + object.user : '');
        result += (object.host ? '@' + object.host : '');
        result += ' ';
    }

    result += object.command;
    if (object.parameters && object.parameters.length) {
        if (object.parameters.length > 1) {
            result += ' ' + object.parameters.slice(0, -1).join(' ');
        }

        result += ' :' + object.parameters[object.parameters.length - 1];
    }

    return result + '\r\n';
}

function stringToMessage(ircMessage) {
    var result = { raw: ircMessage };

    ircMessage = parsePrefix.call(result, ircMessage);
    ircMessage = parseCommand.call(result, ircMessage);
    ircMessage = parseParameters.call(result, ircMessage);

    return result;
}

function parsePrefix(ircMessage) {
    if (ircMessage.charAt(0) == ':') {
        var prefixEnd = ircMessage.indexOf(' '),
            prefix = ircMessage.slice(1, prefixEnd),
            prefixSplit = prefix.split(/[!@]/);

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

function parseUntilSpace(ircMessage) {
    var end = ircMessage.indexOf(' '),
        end = end == -1 ? ircMessage.length : end;

    return ircMessage.slice(0, end);
}
