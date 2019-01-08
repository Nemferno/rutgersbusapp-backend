const geohash = require('ngeohash');

const argv = process.argv;
const lat = Number.parseFloat(argv[2].replace(',', ''));
const lon = Number.parseFloat(argv[3]);

console.log({ en: geohash.encode(lat, lon, 12) });
