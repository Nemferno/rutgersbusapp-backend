const ENV = process.env.NODE_ENV;
if(ENV === 'dev') {
    require('dotenv').config();
}

const https = require('https');
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
                let process = processReminder(reminder)
                .then((event) => {
                    if(event) { console.log({ event, id: reminder.reminderid }); }
                    cb();
                })
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
    let { userid, iscomplete, reminderid, localestimate, reminderduration, startDate, evblocked, pending, target, universityid, stopid, routeid, reminderexpected } = reminder;

    console.log({ reminderexpected });

    if((pending & 0x80) === 0x80) {
        return Promise.resolve('Reminder halted');
    }

    // if((pending & 0x20) === 0x20) {
    //     return Promise.resolve('Reminder has unknown cause event');
    // }

    /** @type {UniversityConfig} */
    let config;
    let routestopinfo;
    return db.getRouteStop(routeid, stopid, universityid)
    .then((data) => {
        if(!data[0]) throw new Error(`No route, stop combination exists. (${ routeid }, ${ stopid })`);
        routestopinfo = data[0];

        return UniversityConfigController.get(universityid);
    })
    .then(_config => {
        config = _config;
        return config.getStopTimes(routestopinfo.routeserviceid, routestopinfo.stopserviceid);
    })
    .then((data) => {
        let times = null;
        if(!data[routestopinfo.stopserviceid]) {
            times = [];
        } else {
            /** @type {StopTime[]} */
            times = data[routestopinfo.stopserviceid][routestopinfo.routeserviceid];
        }

        if(times.length === 0) {
            // check if the bus has any events
            return config.getVehicles()
            .then((vehicles) => {
                /** @type {Vehicle} */
                const vehicle = vehicles.find(e => e.id === target);
                if((vehicle & 0x1) === 0x1) 
                {
                    // raise a break event
                    pending |= 0x4;
                    if((evblocked & 0x4) !== 0x4) {
                        sendBreakNotification(userid, vehicle.name, route)
                        .catch((err) => console.error({ error: err }));

                        evblocked |= 0x4;
                        pending ^= 0x4;
                    }

                    return true;
                }

                return false;
            })
            .then((isEvent) => {
                if(!isEvent) {
                    // no route...
                    sendNoVehicleNotification(userid, routestopinfo)
                    .catch((err) => console.error({ error: err }));
                    db.updateReminderByWorker(reminderid, localestimate, evblocked, pending, target, new Date(reminderexpected), true);
                    throw null;
                }
            });
        }

        return times;
    })
    .then((times) => {
        return config.getVehicles()
        .then((vehicles) => {
            return { times, vehicles };
        });
    })
    .then((data) => {
        const { times, vehicles } = data;
        if(target) {
            // we need to consider if an earlier bus comes
            const rank = (pending >>> 8) & 0xF;
            // estimates should be 5 minutes interval
            let frame = times[rank];

            if(rank != 0xF || !frame) {
                let found = false;
                for(let i = 0; i < times.length; i++) {
                    const subframe = times[i];
                    if(subframe.bus === target) {
                        frame = subframe;

                        pending &= 0x100FF;
                        pending |= (i << 8);
                        found = true;
                        break;
                    }
                }

                if(!found) {
                    pending |= 0x20;
                    
                    if((evblocked & 0x20) !== 0x20) {
                        const vehicle = vehicles.find(e => e.id === target);

                        console.log('rank event unknown cause');
                        sendUnknownNotification(userid, vehicle.name, routestopinfo)
                        .catch((err) => console.error({ error: err }));

                        evblocked |= 0x20;
                        pending ^= 0x20;
                    }

                    pending |= (0x01 << 0x20);
                    target = times[0].bus;
                    reminderexpected = times[0].time;
                    console.log('!found');
                }
            }

            if(target !== frame.bus) {
                let found = false;
                for(let i = 0; i < rank; i++) {
                    const subframe = times[i];
                    if(subframe.bus === target) {
                        frame = subframe;
                        // clear rank content
                        pending &= 0x100FF;
                        pending |= (i << 8);
                        found = true;
                        break;
                    }   
                }

                // unknown cause notification check
                if(!found) {
                    // check if it is from rank + 1 to length
                    found = false;
                    let index = 0;
                    for(let i = rank; i < times.length; i++) {
                        const subframe = times[i];
                        if(subframe.bus === target) {
                            frame = subframe;
                            index = i;
                            found = true;
                            break;
                        }
                    }

                    if(found) {
                        // re-set the target, reminderexpected
                        // set the reminder to 'init' mode
                        pending |= (0x01 << 0x20);

                        const vehicle = vehicles.find(e => e.id === frame.bus);
                        sendEarlyBusNotification(userid, vehicle.name, routestopinfo)
                        .catch((err) => console.error({ error: err }));

                        target = frame.bus;
                        reminderexpected = frame.time;
                        console.log('found');
                    } else {
                        pending |= 0x20;
                        
                        if((evblocked & 0x20) !== 0x20) {
                            console.log('vehicle could not be found');
                            const vehicle = vehicles.find(e => e.id === target);
                            sendUnknownNotification(userid, vehicle.name, routestopinfo)
                            .catch((err) => console.error({ error: err }));

                            evblocked |= 0x20;
                            pending ^= 0x20;
                        }

                        pending |= (0x01 << 0x20);
                        target = times[0].bus;
                        reminderexpected = times[0].time;
                        console.log('!found');
                    }
                }
            } else {
                const frameDate = new Date(frame.time);
                const expected = new Date(reminderexpected);

                console.log({ where: '!reminderexpected', frame: frameDate.toString(), expected: expected.toString() });
                const difference = Math.abs(frameDate - expected) / 1000;
                if(difference > 5 * 60) { // 5 minutes
                    const rank = (pending >>> 8) & 0xF;
                    const close = null;
                    const value = Number.MAX_VALUE;
                    for(let i = 0; i < rank; i++) {
                        const subframe = times[i];
                        if(subframe.bus === target) {
                            const subDate = new Date(new Date(subframe.time).toISOString());
                            const difference = Math.abs(subDate - expected) / 1000;
                            if(difference < value) {
                                value = difference;
                                close = subframe;
                            }
                        }
                    }

                    // unknown cause notification check
                    if(!close) {
                        pending |= 0x20;

                        if((evblocked & 0x20) !== 0x20) {
                            console.log('could not find a close enough time arrival to the one being tracked');
                            const vehicle = vehicles.find(e => e.id === target);
                            sendUnknownNotification(userid, vehicle.name, routestopinfo)
                            .catch((err) => console.error({ error: err }));
    
                            evblocked |= 0x20;
                            pending ^= 0x20;
                        }

                        pending |= (0x01 << 0x20);
                        target = times[0].bus;
                        reminderexpected = times[0].time;
                        console.log('!reminderexpected');
                    } else {
                        frame = close;
                    }
                }
            }
        } else {
            target = times[0].bus;
            reminderexpected = times[0].time;
            console.log('rank else');
            pending &= 0x100FF;
            pending |= (0 << 8);
        }

        return data;
    })
    .then((data) => {
        const { times, vehicles } = data;

        const oldFlag = (pending >>> 0x20) & 0x01;
        if(oldFlag === 0)
            return data;

        /** @type {Vehicle} */
        const vehicle = vehicles.find(e => e.id === target);
        if((vehicle & 0x1) === 0x1) 
        {
            // raise a break event
            pending |= 0x4;
            if((evblocked & 0x4) !== 0x4) {
                sendBreakNotification(userid, vehicle.name, route)
                .catch((err) => console.error({ error: err }));

                evblocked |= 0x4;
                pending ^= 0x4;
            }
        }

        return data;
    })
    .then((data) => {
        const { times, vehicles } = data;

        const oldFlag = (pending >>> 32) & 1;
        const rank = (pending >>> 8) & 0xF;
        const frame = times[rank];
        if(oldFlag === 1) {
            const expected = new Date(reminderexpected);
            const frameDate = new Date(frame.time);
            const now = new Date(Date.now());

            const minutes = Math.abs(expected - now) / 60000;
            localestimate = minutes;

            const gap = Math.abs(frameDate - expected) / 60000;
            console.log({ gap, frameDate, expected });
            if(gap > 5.0) {
                pending |= 0x02;

                // late notification check
                if((evblocked & 0x02) !== 0x02) {
                    /** @type {Vehicle} */
                    const vehicle = vehicles.find(e => e.id === target);

                    sendLateNotification(userid, vehicle.name, routestopinfo, gap.toFixed(0))
                    .catch((err) => console.error({ error: err }));

                    evblocked |= 0x02;
                    pending ^= 0x02;
                }
            }

            if(minutes <= reminderduration) {
                console.log('send');
                pending |= 0x1;
                // remind notification check
                if((evblocked & 0x1) !== 0x1) {
                    const vehicle = vehicles.find(e => e.id === target);

                    sendReminder(userid, vehicle.name, routestopinfo, minutes.toFixed(0))
                    .catch((err) => console.error({ error: err }));

                    db.updateActualReminder(reminderid, new Date());

                    evblocked |= 0x1;
                    pending ^= 0x1;
                }

                iscomplete = true;
            }
        } else {
            const expected = new Date(reminderexpected);
            const frameDate = new Date(frame.time);
            const now = new Date(Date.now());

            console.log('else', reminderexpected);
            const minutes = Math.abs(expected - now) / 60000;
            localestimate = minutes;
            pending |= 0x10000;

            if(minutes <= reminderduration) {
                console.log('send');
                pending |= 0x1;
                // remind notification check
                if((evblocked & 0x1) !== 0x1) {
                    const vehicle = vehicles.find(e => e.id === target);

                    sendReminder(userid, vehicle.name, routestopinfo, minutes.toFixed(0))
                    .catch((err) => console.error({ error: err }));

                    db.updateActualReminder(reminderid, new Date());

                    evblocked |= 0x1;
                    pending ^= 0x1;
                }

                iscomplete = true;
            }
        }

        const date = new Date(reminderexpected);
        const frameDate = new Date(frame.time);
        date.setTime(date.getTime() - (frameDate.getTimezoneOffset() * 60 * 1000));

        return db.updateReminderByWorker(reminderid, localestimate, evblocked, pending, target, date, iscomplete);
    })
    .catch((err) => {
        if(err) {
            console.error({ error: err });
        }

        if(!err) {        
            const date = new Date(reminderexpected);
            const frameDate = new Date(frame.time);
            date.setTime(date.getTime() - (frameDate.getTimezoneOffset() * 60 * 1000));
            return db.updateReminderByWorker(reminderid, localestimate, evblocked, pending, target, date, iscomplete);
        } else {
            return false;
        }
    });
}

/**
 * @returns {Promise<boolean>}
 */
function sendNoVehicleNotification(userid, routestopinfo) {
    return sendNotification(
        'No Vehicles Alert', 
        `Your tracked ${ routestopinfo.routename } route for ${ routestopinfo.stopname } is offline. We are sorry for the inconvenience. Please check the schedules.`,
        userid,
        false,
        {
            'type': '0',
            'stopid': routestopinfo.stopid,
            'routeid': routestopinfo.routeid
        }
    );
}

function sendEarlyBusNotification(userid, target, routestopinfo) {
    return sendNotification(
        'Earlier Bus Arriving',
        `We are tracking an earlier ${ routestopinfo.routename } route bus (#${ target }) for ${ routestopinfo.stopname}.`,
        userid,
        false,
        {
            'type': '0',
            'stopid': routestopinfo.stopid,
            'routeid': routestopinfo.routeid
        }
    );
}

/**
 * @returns {Promise<boolean>}
 */
function sendLateNotification(userid, target, routestopinfo, gap) {
    return sendNotification(
        'Late Arrival Alert', 
        `Your tracked ${ routestopinfo.routename } bus (#${ target }) for ${ routestopinfo.stopname } is in traffic. It will take ${ gap } more minutes until it arrives.`,
        userid,
        false,
        {
            'type': '0',
            'stopid': routestopinfo.stopid,
            'routeid': routestopinfo.routeid
        }
    );
}

/**
 * @returns {Promise<boolean>}
 */
function sendUnknownNotification(userid, target, routestopinfo) {
    return sendNotification(
        'Unknown Cause Alert',
        `We do not know what happened to your tracked ${ routestopinfo.routename } bus (#${ target }) for ${ routestopinfo.stopname }. We are sorry for the inconvenience. Please create a new reminder.`,
        userid,
        false,
        {
            'type': '0',
            'stopid': routestopinfo.stopid,
            'routeid': routestopinfo.routeid
        }
    );
}

/**
 * @returns {Promise<boolean>}
 */
function sendBreakNotification(userid, target, routestopinfo) {
    return sendNotification(
        'Break Alert',
        `Your tracked ${ routestopinfo.routename } bus (#${ target }) for ${ routestopinfo.stopname } is on break. We will automatically adjust if the next bus will arrive sooner.`,
        userid,
        false,
        {
            'type': '0',
            'stopid': routestopinfo.stopid,
            'routeid': routestopinfo.routeid
        }
    );
}

/**
 * @returns {Promise<boolean>}
 */
function sendReminder(userid, target, routestopinfo, duration) {
    return sendNotification(
        `Bus Arriving in ${ duration } Mins`,
        `Your tracked ${ routestopinfo.routename } bus (#${ target }) for ${ routestopinfo.stopname } is coming in ${ duration } minutes. Please be ready to attend the bus.`,
        userid,
        true,
        {
            'type': '1',
            'stopid': routestopinfo.stopid,
            'routeid': routestopinfo.routeid
        }
    );
}

/**
 * @returns {Promise<boolean>}
 */
function sendNotification(title, content, userid, remind, payload) {
    return new Promise((resolve, reject) => {
        const request = https.request({
            hostname: 'onesignal.com',
            port: 443,
            path: '/api/v1/notifications',
            method: 'POST',
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": "Basic " + process.env.ONESIGNAL_PRIVATE_KEY
            }
        }, (res) => {
            res.on('data', function(data) {
                const { id } = JSON.parse(data.toString());
                if(id) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
        request.on('error', (err) => {
            reject(err);
        });
        request.write(JSON.stringify({
            app_id: process.env.ONESIGNAL_APP_ID,
            headings: {
                "en": "Reminder Alert - " + title
            },
            contents: {
                "en": content,
            },
            data: payload,
            template_id: (remind) ? '5ffa2fb1-fb60-43b1-b8b8-bb99aa01a3cf' : 'c21a53e5-ede7-4fe7-b9d8-503929349ed3',
            include_player_ids: [ userid ]
        }));
        request.end();
    });
}

module.exports = run;
