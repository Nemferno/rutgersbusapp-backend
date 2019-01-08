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
 * Gets configuration of a route
 * @returns {Promise<{routeid:string, routename:string, stops:{stopid:string,stopname:string,coord:string,stopserviceid:string}[], segments:{}[]}[]>}
 */
function getRouteConfiguration(routeid, universityid) {
    if(!routeid || !universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any('SELECT R.routeid, R.routename, array_to_json(array_agg(S.* ORDER BY RS.stoporder)) AS stops, array_to_json(array_agg(RSEG.*) FILTER (WHERE RSEG.segmentid IS NOT NULL)) AS segments' +
        ' FROM (((route AS R INNER JOIN routestop AS RS ON R.routeid=RS.routeid) INNER JOIN stop AS S ON RS.stopid=S.stopid) LEFT JOIN routesegment AS RSEG ON R.routeid=RSEG.routeid)' +
        ' LEFT JOIN segment AS SEG ON SEG.segmentid=RSEG.segmentid WHERE R.universityid=$2 AND R.routeid=$1 GROUP BY R.routeid, R.routename', [ routeid, universityid ]);
}

/**
 * Get stops of a route
 * @returns {Promise<{stopid:string,stopname:string,coord:string,stopserviceid:string}[]>}
 */
function getRouteStops(routeid, universityid) {
    if(!routeid || !universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any('SELECT S.stopname, S.coord, S.stopserviceid FROM ((Route AS R INNER JOIN RouteStop AS RS ON R.routeid=RS.routeid) INNER JOIN ' +
        'Stop AS S ON RS.stopid=S.stopid) WHERE R.universityid=$2 AND R.routeid=$1', [ routeid, universityid ]);
}

/**
 * Gets online routes at a specified date
 * @returns {Promise<{routeid:string, scheduledate:string}[]}
 */
function getOnlineRoutes(scheduledate, universityid) {
    if(!scheduledate || !universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any('SELECT R.routeid, R.routename, R.direction, R.routeserviceid FROM route AS R ' + 
        'INNER JOIN (SELECT DISTINCT routeid, scheduledate FROM BusSchedule WHERE scheduledate=$1 ' +
        'AND finished=FALSE AND universityid=$2) AS Q ON Q.routeid = R.routeid', [ scheduledate, universityid ]);
}

/**
 * Gets all routes
 * @returns {Promise<{routeid:string, routename:string, direction:string, routeserviceid:string }[]>}
 */
function getAllRoutes(universityid) {
    if(!universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any('SELECT R.routeid, R.routename, R.direction, R.routeserviceid FROM route AS R WHERE R.universityid=$1', [ universityid ]);
}

/**
 * Add a new ZipCode
 * @returns {Promise}
 */
function addZipCode(zipcode, city, state) {
    if(!zipcode || !city || !state) return Promise.reject('Null: ' + arguments.callee.name);

    return db.none('INSERT INTO zipcode (zipcode, city, us_state) '
        + 'VALUES($1, $2, $3)', [ zipcode, city, state ]);
}

/**
 * Create a new University
 * @returns {Promise}
 */
function addUniversity(uniname, uniaddress, unizipcode) {
    if(!uniname || !uniaddress || !unizipcode) return Promise.reject('Null: ' + arguments.callee.name);

    return db.none('INSERT INTO university (universityid, universityname, streetaddress, zipcode) '
        + 'VALUES($1, $2, $3)', [ uniname, uniaddress, unizipcode ]);
}

/**
 * Gets all universities stored
 * @returns {Promise<Array>}
 */
function getUniversities() {
    return db.any('SELECT U.universityid, U.serviceid, V.vendorname FROM University AS U RIGHT JOIN Vendor AS V ON U.vendorid = V.vendorid');
}

/**
 * Get data for a university
 * @returns {Promise}
 */
function getUniversity(id) {
    if(!id) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any('SELECT U.universityid, U.serviceid, V.vendorname FROM University AS U RIGHT JOIN Vendor AS V ON U.vendorid = V.vendorid WHERE U.universityid=$1',
        [ id ]);
}

/**
 * Creates a bus based on its id
 * @param {Vehicle} vehicle - the updated vehicle information
 * @returns {Promise}
 */
function createBus(vehicle, universityid) {
    if(!vehicle || !universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.none('INSERT INTO bus (busid, universityid) VALUES($1, $2)', [ vehicle.id, universityid ]);
}

/**
 * Gets a bus based on its id
 * @param {string} id - vehicle id
 * @param {string} universityid - university
 * @returns {Promise}
 */
function getBus(id, universityid) {
    if(!id || !universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any('SELECT * FROM Bus WHERE busid=$1 AND universityid=$2',
        [ id, universityid ]);
}

/**
 * Gets all buses in the university
 * @param {number} universityid - the desired university
 * @returns {Promise<Array>}
 */
function getBuses(universityid) {
    if(!universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any('SELECT busid FROM bus WHERE universityid=$1', universityid);
}

/**
 * Adds an active bus into the database
 * @param {Vehicle} vehicle - the vehicle to be active
 * @param {string} universityid - associated university
 * @param {Date} scheduledate - the day/month/year of the activity
 * @returns {Promise}
 */
function addBusSchedule(vehicle, routeid, universityid, scheduledate) {
    if(!vehicle || !universityid || !routeid || !scheduledate) return Promise.reject('Null: ' + arguments.callee.name);

    return db.none("INSERT INTO busschedule (busid, routeid, universityid, scheduledate) "
        + "VALUES($1, $2, $3, $4)", [ vehicle.id, routeid, universityid, scheduledate.toDateString()]);
}

/**
 * Sets an active bus to a completed schedule
 * @param {Vehicle} vehicle - the vehicle to be inactive
 * @param {string} universityid - associated university
 * @param {Date} scheduledate - the day/month/year of the activity
 * @returns {Promise}
 */
function putBusScheduleCompleted(vehicle, routeid, universityid, scheduledate) {
    if(!vehicle || !universityid || !routeid || !scheduledate) return Promise.reject('Null: ' + arguments.callee.name);

    return db.none("UPDATE busschedule SET finished=TRUE WHERE busid=$1 AND routeid=$2 AND universityid=$3 AND scheduledate=$4",
        [ vehicle.id, routeid, universityid, scheduledate.toDateString() ]);
}

/**
 * Gets all bus schedules in the database (includes active and completed schedules)
 * @param {Date} scheduledate - the day/month/year of the desired schedules
 * @param {string} universityid - the desired university
 * @returns {Promise<Array>}
 */
function getAllBusSchedules(scheduledate, universityid) {
    if(!scheduledate || !universityid) return Promise.reject();

    return db.any("SELECT BS.busid, BS.routeid, BS.universityid, BS.finished, R.routename, R.direction, R.routeserviceid FROM (BusSchedule AS BS INNER JOIN Route AS R ON BS.routeid = R.routeid)"
        + " WHERE BS.universityid=$1 AND BS.scheduledate=$2", [ universityid, scheduledate.toDateString() ]);
}

/**
 * Gets all active bus schedules in the database
 * @param {Date} scheduledate - the day/month/year of the desired schedules
 * @param {string} universityid - the desired university
 * @returns {Promise<Array>}
 */
function getActiveBusSchedules(scheduledate, universityid) {
    if(!scheduledate || !universityid) return Promise.reject();

    return db.any("SELECT BS.busid, BS.routeid, BS.universityid, BS.finished, R.routename, R.direction, R.routeserviceid FROM (BusSchedule AS BS INNER JOIN Route AS R ON BS.routeid = R.routeid)"
        + " WHERE BS.universityid=$1 AND BS.scheduledate=$2 AND BS.finished=FALSE", [ universityid, scheduledate.toDateString() ]);
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
function addVehicleHistory(frame, vehicle, routeid, universityid, scheduledate) {
    if(!frame || !vehicle || !universityid || !scheduledate) return Promise.reject('Null: ' + arguments.callee.name);

    const hashed = geohash.encode(frame.lat, frame.lon, 12);

    return db.none("INSERT INTO schedulehistory (busid, routeid, universityid, scheduledate, coord, recordedstamp, speed) "
        + "VALUES($1, $2, $3, $4, $5, $6, $7)",
        [ vehicle.id, routeid, universityid, scheduledate.toDateString(), hashed, frame.timestamp.toISOString(), frame.speed ]);
}

/**
 * Gets the history of the desired vehicle at a desired time
 * @param {Vehicle} vehicle - desired vehicle
 * @param {string} universityid - university tied to vehicle
 * @param {Date} scheduledate - desired history date
 * @returns {Promise<Array>}
 */
function getVehicleHistoryAt(vehicle, universityid, scheduledate) {
    if(!vehicle || !universityid || !scheduledate) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any("SELECT coord, timestamp FROM schedulehistory WHERE busid=$1 AND routeid=$2 AND universityid=$3 AND "
        + "scheduledate=$4", [ vehicle.id, vehicle.routeTag, universityid, scheduledate.toDateString() ]);
}

/**
 * Gets the route information
 * @param {string} routeid - desired route
 * @param {string} universityid - university associated with route
 * @returns {Promise<Array>}
 */
function getRoute(routeid, universityid) {
    if(!routeid || !universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any("SELECT routeid, name, direction FROM route WHERE routeid=$1 AND universityid=$2",
        [routeid, universityid]);
}

/**
 * Gets the route information via its service provider
 * @param {string} serviceid
 * @param {string} universityid - university associated with route
 * @returns {Promise<Array>}
 */
function getRouteByService(serviceid, universityid) {
    if(!serviceid || !universityid) return Promise.reject('Null: ' + arguments.callee.name);

    return db.any("SELECT routeid, routename, direction, routeserviceid FROM route WHERE routeserviceid=$1 AND universityid=$2",
        [serviceid, universityid]);
}

module.exports = {
    getAllRoutes,
    getRouteStops,
    getRouteConfiguration,
    getOnlineRoutes,
    getRouteByService,
    getUniversity,
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
