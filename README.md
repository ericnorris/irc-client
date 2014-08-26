# yirc - yet another IRC client
Another offering to the god of IRC, for node.js.

## Installation
`npm install yirc`

## Example
```javascript
var yirc = require('yirc');
var bot = new yirc({hostname: 'yourserver', port: 6667, nick: 'yournick'});
bot.on('register', function() {
    bot.join('#yourchannel', function(err, bot) {
        bot.privmsg('#yourchannel', 'hello world!');
    });
});
```

## Documentation
yirc offers callbacks for IRC commands, providing an error if the command failed. Callbacks are run AFTER the server acknowledged the command, e.g. when the ```join()``` callback fires you can be sure you are actually in the channel!

(psst: they also return promises, see below)

### `new yirc(options)`
Default options are located in [defaults.js](./src/defaults.js)

* `autoconnect` - whether or not to connect to the server on instantiation (default: `true`)
* `nick` - the nick to use when connecting (default: `'ircclient'`)
* `user` - the user to provide when registering (default: `'ircclient'`)
* `mode` - the numeric mode to provide when registering (default: `8`)
* `realName` - the real name to provide when registering (default: `'irc client'`)
* `host` - the address of the IRC server (default: `'localhost'`)
* `port` - the port to use when connecting (default: `6667`)
* `debug` - whether or not to print debug statements to stdout
* `maxNickLength` - the maximum allowed nick length. If the server advertises a length on connect, that will be used instead. (default: `9`)
* `maxChannelLength` - the maximum allowed channel name length. If the server advertises a length on connect, that will be used instead. (default: `50`)
* `quitMessage` - the default message to use for `quit()` (default `'tidal waves of emotion'`)

### Methods
`connect(callback(err, client))`

Connects to the server and port.

`nick(nick, callback(err, client)`

Sends a `NICK` command to the server.

`user(callback(err, client))`

Sends a `USER` command to the server. This is performed automatically on `connect()`, and will likely error if used afterwards.

`join(channel, callback(err, client))`

Sends a `JOIN` command to the server to join the specified channel.

`part(channel, message, callback(err, client))`

Sends a `PART` command to the server to leave the specified channel, with an optional parting message.

`privmsg(target, message)`

Sends a `PRIVMSG` command to send a message to the specified target (e.g. nick or channel).

`whois(nick, callback(err, whoisdata))`

Sends a `WHOIS` command to the server to query information about the specified nick. `WHOIS` data follows this format:
```javascript
{
    user: "the username",
    host: "the user's host",
    realName: "the user's realname",
    server: "the server the user is connected to",
    serverInfo: "info about the server",
    operator: true,
    idleTime: "the amount of time the user has been idle",
    away: "the user's away message",
    channels: ["#channel1", "#channel2", ...],
    operatorChannels: ["#channel1"],
    moderatedChannels: [],
}
```

`quit(quitMessage)`

Sends a `QUIT` command to the server. If no `quitMessage` parameter is specified, the default will be used.

### Events
`on('message', function(messageObject))` - fired when an IRC message is received from the server.

Every IRC command is also emitted as an event. Example:

`on('PRIVMSG', function(messageObject))` - fired when a `PRIVMSG` is received.

### Message Object
Example message from the [IRC RFC](http://tools.ietf.org/html/rfc2812#section-3.3.1):
```javascript
{
    raw: ":Angel!wings@irc.org PRIVMSG Wiz :Are you receiving this message ?",
    prefix: ":Angel!wings@irc.org",
    servername: undefined, // see note
    nick: "Angel",
    user: "wings",
    host: "irc.org",
    command: "PRIVMSG",
    parameters: ['Wiz', 'Are you receiving this message ?']
}
```

Note: not all of the fields will be defined for a message object. The available fields are dependent on the type of the message. See the [RFC](http://tools.ietf.org/html/rfc2812#section-3.3.1) for specific examples!

## Promise!
All the methods that take a callback also return a [Q](https://github.com/kriskowal/q) promise, so feel free to use that instead. Example:
```javascript
var yirc = require('yirc');
var bot = new yirc({hostname: 'yourserver', port: 6667, nick: 'yournick'});
bot.on('register', function() {
    bot.join('#yourchannel')
       .invoke('privmsg', '#yourchannel', 'hello world!')
       .invoke('privmsg', '#yourchannel', 'promises are great!')

});
```
