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
    let buses = [];
    let routes = [];
    let current = [];

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
                    return resolve({ list: list, current: [] });
                }
                
                return resolve({ list: list, current: JSON.parse(data) });
            });
        });
    })
    .then((data) => {
        let list = data.list;
        current = data.current;
        return new Promise((resolve, reject) => {
            async.each(list, (bus, cb) => {
                let tag = bus.routeTag;
                if(!routes.includes(tag)) routes.push(tag);

                buses.push(bus);

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
        let keep = current.filter((e) => {
            return buses.includes(e.name);
        });

        let remove = current.filter((e) => {
            return !buses.includes(e.name);
        });
        for(let i = 0; i < remove.length; i++) {
            db.putBusScheduleCompleted(remove[i], universityid, new Date());
        }

        cache.replace(`${ universityid }_buses`, JSON.stringify(keep), { expires: 60 * 60 });
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

        return Promise.resolve();
    }).then(() => {
        let found = currentList.find((e) => {
            return e.name === newBus.name;
        });

        if(found)
            return Promise.resolve({ found: true, data: found });
        else
            return Promise.resolve({ found: false, data: newBus });
    })
    .then((result) => {
        return db.getActiveBusSchedules(new Date(), universityid)
        .then((list) => {
            let find = list.find((value) => {
                return value.busid === newBus.id &&
                value.routeserviceid === newBus.routeTag;
            });

            if(find) {
                return Promise.resolve({ nocreat: true, data: result.data });
            } else {
                // must create a route schedule
                currentList.push(newBus);
                
                return db.getRouteByService(newBus.routeTag, universityid)
                .then((data) => {
                    data = data[0];

                    if(data) {
                        return db.addBusSchedule(result.data, data.routeid, universityid, new Date());
                    } else {
                        return Promise.reject();
                    }
                });
            }
        });
    })
    .then((result) => {
        /** @type {Vehicle} */
        let bus = result ? result.data : newBus;
        if(result) {
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
