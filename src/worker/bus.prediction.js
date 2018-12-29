const ENV = process.env.NODE_ENV;
if(ENV === 'dev') {
    require('dotenv').config();
}

const async = require('async');
const { UniversityConfig } = require('../adapter/uniconfig');
const { UniversityConfigController } = require('../adapter/uniconfigcontroller');
const { CacheObject } = require('../memcache');
const { Vehicle } = require('../model/vehicle');
const db = require("../query");
const cache = new CacheObject();

function run() {
    try {
        db.getUniversities()
        .then((data) => {
            for(let i = 0; i < data.length; i++) {
                let universityid = data[i];
                process(universityid);
            }
        })
        .catch((err) => {
            throw err;
        });
    } catch(err) {
        console.error({ error: err });
    }
}

function process(universityid) {
    /** @type {UniversityConfig} */
    let config = null;
    let buses = [];
    let routes = [];

    UniversityConfigController.get(universityid)
    .then((_config) => {
        config = _config;
        return ((typeof config.ready) === 'function') ? config.ready() : config.ready;
    })
    .then(() => {
        return config.adapter.vehicles();
    })
    .then((list) => {
        return new Promise((resolve, reject) => {
            cache.get(`${ unid }_buses`, (err, data) => {
                if(err || !data) {
                    err && console.error({ error: err });
                    return Promise.resolve({ list: list, current: [] });
                }
                
                return Promise.resolve({ list: list, current: JSON.parse(data) });
            });
        });
    })
    .then((data) => {
        let list = data.list;
        let current = data.current;
        return new Promise((resolve, reject) => {
            async.each(list, (bus, cb) => {
                let tag = bus.routeTag;
                if(!routes.includes(tag)) routes.push(tag);

                // do something
                processBus(bus, universityid, current)
                .then(() => cb())
                .catch((err) => cb(err));
            }, (err) => {
                if(err) { return reject(err); }

                resolve();
            });
        });
    })
    .then(() => {
        // save the information
        cache.set(`${ universityid }_online`, JSON.stringify(routes), { expires: 60 * 60 });
        return Promise.resolve();
    })
    .then(() => {
        // find out if a vehicle has completed its schedule
        let keep = currentList.filter((e) => {
            return buses.includes(e.name);
        });
        cache.replace(`${ unid }_buses`, JSON.stringify(keep), { expires: 60 * 60 });
    })
    .catch((err) => {
        console.error({ error: err });
    });
}

// what to do in this process?
// 1) store bus information
// 2) store old information to database
// cannot use this unless we have previous evidence
// 3) use prediction measures (statistics)
/**
 * Process the buses
 * @param {Vehicle} newBus - the bus being processed
 * @param {string} universityid - associated university
 * @param {Vehicle[]} currentList - the current list in the cache
 * @returns {Promise}
 */
function processBus(newBus, universityid, currentList) {
    // check if the bus exists in the database, remember it later
    return db.getBus(newBus.id, universityid)
    .then((result) => {
        if(!result) {
            return db.createBus(newBus, universityid);
        }

        return Promise.resolve();
    }).then(() => {
        return new Promise((resolve, reject) => {
            let found = currentList.find((e) => {
                return e.name === newBus.name;
            });
            if(found)
                return Promise.resolve({ found: true, data: found });
            else
                return Promise.resolve({ found: false, data: newBus });
        });
    })
    .then((result) => {
        if(result.found) {
            // no need to create a route schedule
            return Promise.resolve({ nocreat: true, data: result.data });
        } else {
            // must create a route schedule
            currentList.push(newBus);
            return db.addBusSchedule(result.data, universityid, new Date());
        }
    })
    .then((result) => {
        /** @type {Vehicle} */
        let bus = result.nocreat ? result.data : newBus;
        if(result.nocreat) {
            // we can do statistics and store history
            if(bus.lat !== newBus.lat || bus.lon !== newBus.lon) {
                let date = new Date();
                let frame = {
                    timestamp: date,
                    lat: bus.lat,
                    lon: bus.lon,
                    speed: bus.speed
                };
                db.addVehicleHistory(frame, bus, universityid, date);

                bus.heading = newBus.heading;
                bus.lat = newBus.lat;
                bus.lon = newBus.lon;
                bus.lastUpdated = newBus.lastUpdated;
                bus.speed = newBus.speed;
            }
        }
    });
}

module.exports = run;
