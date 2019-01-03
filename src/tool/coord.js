const geohash = require('ngeohash');


const [ lat, lon ] =  [ 40.521897, -74.463291 ];

console.log({ en: geohash.encode(lat, lon, 12) });
