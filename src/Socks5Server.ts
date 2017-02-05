'use strict';

const port = 1080;

const socks5 = require('simple-socks');
const server = socks5.createServer().listen(port);

console.info("The socks5 server listen at port %d.", port);

server.on('proxyConnect', function (info, destination) {
    console.log('connected to remote server at %s:%d', info.host, info.port);
});

server.on('proxyData', function (data: Buffer) {
    //console.log(data.length);
});


server.on('proxyError', function (err: Error) {
    console.error('unable to connect to remote server');
    console.error(err);
});

// When a proxy connection ends
server.on('proxyEnd', function (response, args) {
    console.log('socket closed with code %d', response);
    //console.log(args);
});