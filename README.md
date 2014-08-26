# yirc - yet another irc client
Another offering to the god of IRC, for node.js.

## Installation
```npm install yirc```

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
yirc offers callbacks for irc commands, providing an error if the command failed. Callbacks are run AFTER the server acknowledged the command, e.g. when the ```join()``` callback fires you can be sure you are actually in the channel!

``` new yirc(options) ```

### Methods
```connect(callback(err, client))```

```nick(nick, callback(err, client)```

```user(callback(err, client))```

```join(channel, callback(err, client))```

```part(channel, message, callback(err, client))```

```privmsg(target, message)```

```whois(nick, callback(err, whoisdata))```

```quit(quitMessage)```
