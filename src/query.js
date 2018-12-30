const ENV = process.env.NODE_ENV;
if(ENV === 'dev') {
    require('dotenv').config();
}

const promise = require('bluebird');
const options = {
    promiseLib: promise
};

const pgp = require('pg-promise')(options);
const URL = process.env.DATABASE_URL;
const db = pgp({
    connectionString: URL,
    ssl: true
});

const geohash = require('ngeohash');

const { Vehicle } = require('./model/vehicle');

/**
 * Gets all ZipCode stored in the database
 * @returns {Promise<Array>}
 */
function getZipCodes() {
    return db.any('SELECT * FROM zipcode');
}

/**
 * Add a new ZipCode
 * @returns {Promise}
 */
function addZipCode(zipcode, city, state) {
    return db.none('INSERT INTO zipcode (zipcode, city, us_state) '
        + 'VALUES($1, $2, $3)', [ zipcode, city, state ]);
}

/**
 * Create a new University
 * @returns {Promise}
 */
function addUniversity(uniname, uniaddress, unizipcode) {
    return db.none('INSERT INTO university (universityid, universityname, streetaddress, zipcode) '
        + 'VALUES($1, $2, $3)', [ uniname, uniaddress, unizipcode ]);
}

/**
 * Gets all universities stored
 * @returns {Promise<Array>}
 */
function getUniversities() {
    return db.any('SELECT universityid FROM university');
}

/**
 * Creates a bus based on its id
 * @param {Vehicle} vehicle - the updated vehicle information
 * @returns {Promise}
 */
function createBus(vehicle, universityid) {
    if(!vehicle || !universityid) return Promise.reject('Null');

    return db.none('INSERT INTO bus (busid, universityid) VALUES($1, $2)', [ vehicle.id, universityid ]);
}

/**
 * Gets a bus based on its id
 * @param {string} id - vehicle id
 * @param {string} universityid - university
 * @returns {Promise}
 */
function getBus(id, universityid) {
    if(!id || !universityid) return Promise.reject('Null');

    return db.any('SELECT * FROM Bus WHERE busid=$1 AND universityid=$2',
        [ id, universityid ]);
}

/**
 * Gets all buses in the university
 * @param {number} universityid - the desired university
 * @returns {Promise<Array>}
 */
function getBuses(universityid) {
    if(!universityid) return Promise.reject('Null');

    return db.any('SELECT busid FROM bus WHERE universityid=$1', universityid);
}

/**
 * Adds an active bus into the database
 * @param {Vehicle} vehicle - the vehicle to be active
 * @param {string} universityid - associated university
 * @param {Date} scheduledate - the day/month/year of the activity
 * @returns {Promise}
 */
function addBusSchedule(vehicle, universityid, scheduledate) {
    if(!vehicle || !universityid || !routeid || !scheduledate) return Promise.reject('Null');

    return db.none("INSERT INTO busschedule (busid, routeid, universityid, scheduledate) "
        + "($1, $2, $3, to_date($4, 'Mon DD YYYY'))", [vehicle.id, vehicle.routeTag, universityid, scheduledate.toISOString()]);
}

/**
 * Sets an active bus to a completed schedule
 * @param {Vehicle} vehicle - the vehicle to be inactive
 * @param {string} universityid - associated university
 * @param {Date} scheduledate - the day/month/year of the activity
 * @returns {Promise}
 */
function putBusScheduleCompleted(vehicle, universityid, scheduledate) {
    if(!vehicle || !universityid || !scheduledate) return Promise.reject('Null');

    return db.none("UPDATE busschedule SET finished=TRUE WHERE busid=$1 AND routeid=$2 AND universityid=$3 AND scheduledate=to_date($4, 'Mon DD YYYY')",
        [ vehicle.id, vehicle.routeTag, universityid, scheduledate.toISOString() ]);
}

/**
 * Gets all bus schedules in the database (includes active and completed schedules)
 * @param {Date} scheduledate - the day/month/year of the desired schedules
 * @param {string} universityid - the desired university
 * @returns {Promise<Array>}
 */
function getAllBusSchedules(scheduledate, universityid) {
    if(!scheduledate || !universityid) return Promise.reject();

    return db.any("SELECT * FROM (busschedule AS BS INNER JOIN bus AS B ON BS.busid = B.busid AND BS.universityid = B.universityid) "
        + "WHERE BS.universityid = $1 AND BS.scheduledate = to_date($2, 'Mon DD YYYY')", [ universityid, scheduledate.toISOString() ]);
}

/**
 * Gets all active bus schedules in the database
 * @param {Date} scheduledate - the day/month/year of the desired schedules
 * @param {string} universityid - the desired university
 * @returns {Promise<Array>}
 */
function getActiveBusSchedules(scheduledate, universityid) {
    if(!scheduledate || !universityid) return Promise.reject();

    return db.any("SELECT * FROM (busschedule AS BS INNER JOIN bus AS B ON BS.busid = B.busid AND BS.universityid = B.universityid) "
        + "WHERE BS.finished=FALSE AND BS.universityid = $1 AND BS.scheduledate = to_date($2, 'Mon DD YYYY')", [ universityid, scheduledate.toISOString() ]);
}

/**
 * Adds a time-coordinate frame at a certain time for the
 * particular bus.
 * @param {({ timestamp: Date, lat: number, lon: number, speed: number })} frame - frame to be stored
 * @param {Vehicle} vehicle - vehicle associated with the frame
 * @param {string} universityid - associated university
 * @param {Date} scheduledate - the day/month/year of the activity
 * @returns {Promise}
 */
function addVehicleHistory(frame, vehicle, universityid, scheduledate) {
    if(!frame || !vehicle || !universityid || !scheduledate) return Promise.reject('Null');

    const hashed = geohash.encode(frame.lat, frame.lon, 12);

    return db.none("INSERT INTO schedulehistory (busid, routeid, universityid, scheduledate, coord, timestamp, speed) "
        + "($1, $2, $3, to_date($4, 'Mon DD YYYY'), $5, to_timestamp($6, 'Mon DD YYYY HH24:MI:SS:MS'))",
        [ vehicle.id, vehicle.routeTag, universityid, scheduledate.toISOString(), hashed, frame.timestamp.toISOString(), frame.speed ]);
}

/**
 * Gets the history of the desired vehicle at a desired time
 * @param {Vehicle} vehicle - desired vehicle
 * @param {string} universityid - university tied to vehicle
 * @param {Date} scheduledate - desired history date
 * @returns {Promise<Array>}
 */
function getVehicleHistoryAt(vehicle, universityid, scheduledate) {
    if(!vehicle || !universityid || !scheduledate) return Promise.reject('Null');

    return db.any("SELECT coord, timestamp FROM schedulehistory WHERE busid=$1 AND routeid=$2 AND universityid=$3 AND "
        + "scheduledate=to_date($4, 'Mon DD YYYY')", [ vehicle.id, vehicle.routeTag, universityid, scheduledate.toISOString() ]);
}

/**
 * Gets the route information
 * @param {string} routeid - desired route
 * @param {string} universityid - university associated with route
 * @returns {Promise<any>}
 */
function getRoute(routeid, universityid) {
    if(!routeid || !universityid) return Promise.reject('Null');

    return db.any("SELECT routeid, name, direction FROM route WHERE routeid=$1 AND universityid=$2",
        [routeid, universityid]);
}

module.exports = {
    addZipCode,
    addUniversity,
    getZipCodes,
    getBus,
    getBuses,
    getRoute,
    getUniversities,
    createBus,
    addBusSchedule,
    putBusScheduleCompleted,
    getAllBusSchedules,
    getActiveBusSchedules,
    addVehicleHistory,
    getVehicleHistoryAt
};
