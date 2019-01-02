// pings to the server
require('https').request({
    port: 443,
    host: 'uninav.herokuapp.com',
    method: 'GET'
}).end();