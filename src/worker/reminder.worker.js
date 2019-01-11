const ENV = process.env.NODE_ENV;
if(ENV === 'dev') {
    require('dotenv').config();
}

const async = require('async');
const { UniversityConfig } = require('../adapter/uniconfig');
const { UniversityConfigController } = require('../adapter/uniconfigcontroller');
const { CacheObject } = require('../memcache');
const { Vehicle } = require('../model/vehicle');
const { Reminder } = require('../model/reminder');
const { StopTime } = require('../model/time');
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
    db.getActiveReminders(universityid)
    .then((reminders) => {
        return new Promise((resolve, reject) => {
            async.each(reminders, (reminder, cb) => {
                processReminder(reminder)
                .then(() => cb())
                .catch((err) => cb(err));
            }, (err) => {
                if(err) { return reject(err); }
                resolve();
            });
        });
    })
    .catch((err) => {
        console.error({ error: err });
    });
}

/**
 * @param {Reminder} reminder
 * @returns Promise<any>
 */
function processReminder(reminder) {
    const { reminderid, localEstimate, reminderDuration, startDate, evblocked, pending, target, universityid, stopid, routeid, reminderExpected } = reminder;

    if(pending & 0x80 === 0x80) {
        return;
    }

    /** @type {UniversityConfig} */
    let config;
    let routestopinfo;
    db.getRouteStop(routeid, stopid, universityid)
    .then((data) => {
        if(!data[0]) throw new Error(`No route, stop combination exists. (${ routeid }, ${ stopid })`);
        routestopinfo = data[0];

        return UniversityConfigController.getConfig(universityid);
    })
    .then(_config => {
        config = _config;
        return config.getStopTimes(routestopinfo.routeserviceid, routestopinfo.stopserviceid);
    })
    .then((data) => {
        if(!data) throw new Error('Something went wrong with getting stop times');

        /** @type {StopTime[]} */
        let times = data[routestopinfo.stopserviceid][routestopinfo.routeserviceid];
        return times;
    })
    .then((times) => {
        if(target) {
            const rank = (pending >>> 8) & 0xF;
            // estimates should be 5 minutes interval
            let frame = times[rank];
            // TODO check if the frame is null

            if(target !== frame.bus) {
                let found = false;
                for(let i = 0; i < rank; i++) {
                    const subframe = times[i];
                    if(subframe.bus === target) {
                        frame = subframe;
                        // clear rank content
                        pending &= 0xFF;
                        pending |= (i << 8);
                        found = true;
                    }   
                }

                if(!found) {
                    pending |= 0b00100000;
                    
                    // TODO send unknown cause notification
                    evblocked |= 0x2F;
                }
            } else {
                const frameDate = new Date(frame.time);
                const expected = new Date(reminderExpected);
                const difference = Math.abs(frameDate - expected) / 1000;
                if(difference > 5 * 60) { // 5 minutes
                    const rank = (pending >>> 8) & 0xF;
                    const close = null;
                    const value = Number.MAX_VALUE;
                    for(let i = 0; i < rank; i++) {
                        const subframe = times[i];
                        if(subframe.bus === target) {
                            const subDate = new Date(subframe.time);
                            const difference = Math.abs(subDate - expected) / 1000;
                            if(difference < value) {
                                value = difference;
                                close = subframe;
                            }
                        }
                    }

                    if(!close) {
                        pending |= 0b00100000;

                        // TODO send unknown cause notification
                        evblocked |= 0x2F;
                    } else {
                        frame = close;
                    }
                }
            }
        } else {
            target = times[0].bus;
            reminderExpected = new Date(times[0].time);
        }

        return { times };
    })
    .then((data) => {
        const { times } = data;

        const oldFlag = (pending >>> 0x20) & 0x01;
        if(oldFlag === 0)
            return data;

        return config.getVehicles()
        .then((vehicles) => {
            /** @type {Vehicle} */
            const vehicle = vehicles.find(e => e.id === target);
            if(vehicle & 0x1 === 0x1) 
            {
                // raise a break event
                pending |= 0x4;
                if(evblocked & 0x4 !== 0x4) {
                    // TODO Send break notification
                    evblocked |= 0x4;
                    pending ^= 0x4
                }
            }

            return data;
        });
    })
    .then((data) => {
        const { times } = data;

        const oldFlag = (pending >>> 0x20) & 0x01;
        if(oldFlag === 1) {
            const minutes = Math.abs(new Date(reminderExpected) - Date.now()) / 60000;
            localEstimate = minutes;

            const rank = (pending >>> 8) & 0xF;
            const frame = times[rank];
            const gap = Math.abs(new Date(frame.time) - new Date(reminderExpected)) / 60000;
            if(gap > 5.0) {
                pending |= 0x02;

                if(evblocked & 0x02 !== 0x02) {
                    // TODO send late notification

                    evblocked |= 0x02;
                    pending ^= 0x02;
                }
            }

            if(minutes <= reminderDuration) {
                // SEND NOTIFICATION

            }
        } else {
            const minutes = Math.abs(new Date(reminderExpected) - Date.now()) / 60000;
            localEstimate = minutes;

            // raise the init flag to finished
            pending |= 0x10000;
        }

        return db.updateReminderByWorker(reminderid, localEstimate, evblocked, pending, target, reminderExpected);
    })
    .catch((err) => {
        console.error({ error: err });
    });
}

module.exports = run;
