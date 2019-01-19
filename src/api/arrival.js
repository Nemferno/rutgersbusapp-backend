const express = require('express');
const router = express.Router();

const { UniversityConfigController } = require('../adapter/uniconfigcontroller');
const { UniversityConfig } = require('../adapter/uniconfig');

const db = require('../query');

const { CacheObject } = require('../memcache');
const cache = new CacheObject();

router.get('/time', function(req, res, next) {
    let { unid, routeid, stopid } = req.query;
    if(!unid || !stopid) {
        throw new Error('Invalid parameters!');
    }

    /** @type {UniversityConfig} */
    let config = null;
    UniversityConfigController.get(unid)
    .then((_config) => {
        config = _config;
        return config.getStopTimes(routeid, stopid);
    })
    .then((e) => {
        return config.getVehicles()
        .then((data) => {
            return { times: e, vehicles: data };
        });
    })
    .then((data) => {
        const { times, vehicles } = data;
        const stops = Object.keys(times);
        for(let i = 0; i < stops.length; i++) {
            const stop = times[stops[i]];
            const routes = Object.keys(stop);
            for(let j = 0; j < routes.length; j++) {
                const route = stop[routes[j]];
                for(let k = 0; k < route.length; k++) {
                    const time = route[k];
                    const vehicle = vehicles.find(e => e.id === Number.parseInt(time.bus));
                    if(vehicle)
                        time.busname = vehicle.name;
                }
            }
        }

        res.status(200).json(times);
    })
    .catch((err) => {
        console.error({ error: err });
        res.status(500).json(null);
    });
});
router.get('/times', function(req, res, next) {
    let { unid, routeid } = req.query;
    if(!unid || !routeid) {
        throw new Error('Invalid parameters!');
    }

    let config = null;
    UniversityConfigController.get(unid)
    .then((_config) => {
        config = _config;
        return config.getRouteTimes(routeid);
    })
    .then((e) => {
        return config.getVehicles()
        .then((data) => {
            return { times: e, vehicles: data };
        });
    })
    .then((data) => {
        const { times, vehicles } = data;
        const stops = Object.keys(times);
        for(let i = 0; i < stops.length; i++) {
            const stop = times[stops[i]];
            const routes = Object.keys(stop);
            for(let j = 0; j < routes.length; j++) {
                const route = stop[routes[j]];
                for(let k = 0; k < route.length; k++) {
                    const time = route[k];
                    const vehicle = vehicles.find(e => e.id === Number.parseInt(time.bus));
                    time.busname = vehicle.name;
                }
            }
        }

        res.status(200).json(times);
    })
    .catch((err) => {
        console.error({ err: err });
        res.status(500).json(null);
    });
});

module.exports = router;