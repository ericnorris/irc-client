var net = require('net');
var split = require('split');
var message = require('./irc-message');

var client = net.connect({port: 6667, host: "localhost"}, function() {
    console.log('connected');
});

client.pipe(split()).on('data', function(line) {
    console.log(line);
    console.log(message(line));
});
