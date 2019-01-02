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
                let universityid = data[i].universityid;
                processUni(universityid);
            }
        })
        .catch((err) => {
            throw err;
        });
    } catch(err) {
        console.error({ error: err });
    }
}

function processUni(universityid) {
    /** @type {UniversityConfig} */
    let config = null;
    let newBuses = [];
    let routes = [];
    let cached = [];

    UniversityConfigController.get(universityid)
    .then((_config) => {
        config = _config;
        return Promise.resolve();
    })
    .then(() => {
        return config.adapter.vehicles();
    })
    .then((list) => {
        return new Promise((resolve, reject) => {
            cache.get(`${ universityid }_buses`, (err, data) => {
                if(err || !data) {
                    err && console.error({ error: err });
                    return resolve({ list: list, cached: [] });
                }
                
                return resolve({ list: list, cached: JSON.parse(data) });
            });
        });
    })
    .then((data) => {
        let list = data.list;
        newBuses = list;
        cached = data.cached;
        return new Promise((resolve, reject) => {
            async.each(list, (bus, cb) => {
                let tag = bus.routeTag;
                if(!routes.includes(tag)) routes.push(tag);

                processBus(bus, universityid, cached)
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
        let keep = cached.filter((e) => {
            return newBuses.find(newB => newB.name === e.name) !== undefined;
        });

        let remove = cached.filter((e) => {
            return newBuses.find(newB => newB.name === e.name) === undefined;
        });

        for(let i = 0; i < remove.length; i++) {
            db.putBusScheduleCompleted(remove[i], universityid, new Date());
        }

        cache.set(`${ universityid }_buses`, JSON.stringify(keep), { expires: 60 * 60 });
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
        result = result[0];
        if(!result) {
            return db.createBus(newBus, universityid);
        }

        return;
    }).then(() => {
        let found = currentList.find((e) => {
            return e.name === newBus.name;
        });

        if(found) {
            return { found: true, data: found };
        } else {
            currentList.push(newBus);
            return { found: false, data: null };
        }
    })
    .then((result) => {
        return db.getActiveBusSchedules(new Date(), universityid)
        .then((list) => {
            let find = list.find((value) => {
                return value.busid === newBus.id &&
                value.routeserviceid === newBus.routeTag;
            });

            if(find) {
                return { nocreat: true, data: result.data, routeid: find.routeid };
            } else {
                // must create a route schedule
                return db.getRouteByService(newBus.routeTag, universityid)
                .then((data) => {
                    data = data[0];

                    if(data) {
                        return db.addBusSchedule(result.data ? result.data : newBus, data.routeid, universityid, new Date())
                        .then(() => {
                            return { nocreat: false, data: result.data, routeid: data.routeid };
                        });
                    } else {
                        return;
                    }
                });
            }
        });
    })
    .then((result) => {
        /** @type {Vehicle} */
        let bus = result && result.data ? result.data : null;
        if(bus) {
            // we can do statistics and store history
            if(bus.lat !== newBus.lat || bus.lon !== newBus.lon) {
                let date = new Date();
                let frame = {
                    timestamp: date,
                    lat: bus.lat,
                    lon: bus.lon,
                    speed: bus.speed
                };
                db.addVehicleHistory(frame, bus, result.routeid, universityid, date);

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
