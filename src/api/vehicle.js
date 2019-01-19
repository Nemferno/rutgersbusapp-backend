const express = require('express');
const router = express.Router();

const { UniversityConfigController } = require('../adapter/uniconfigcontroller');
const { UniversityConfig } = require('../adapter/uniconfig');

const db = require('../query');

const { CacheObject } = require('../memcache');
const cache = new CacheObject();

const async = require('async');

// Vehicle API Only
router.get('/bus', function(req, res, next) {
    let { unid, busid, route } = req.query;
    if(!unid) {
        throw new Error('Invalid parameters!');
    }

    /** @type {UniversityConfig} */
    let config = null;
    UniversityConfigController.get(unid)
    .then((_config) => {
        config = _config;
        return config.getVehicles();
    })
    .then((e) => {
        let payload = null;
        if(busid) {
            payload = (busid) ? e.filter(e => e.name === busid) : e;
        } else if(route) {
            payload = e.filter(e => e.routeTag === route);
        } else {
            payload = e;
        }

        res.status(200).json(payload);
    })
    .catch((err) => {
        next(err);
    });
});

router.get('/online', function(req, res, next) {
    let { unid } = req.query;
    if(!unid) {
        throw new Error('Invalid parameters!');
    }

    /** @type {UniversityConfig} */
    let config = null;
    UniversityConfigController.get(unid)
    .then((_config) => {
        config = _config;
        return config.getVehicles();
    })
    .then((e) => {
        const today = new Date();
        return db.getOnlineRoutes(today.toDateString(), unid)
        .then((data) => {
            return { vehicles: e, routes: data };
        });
    })
    .then((data) => {
        const { vehicles, routes } = data;
        const online = routes.filter(route => vehicles.find(vehicle => vehicle.routeTag === route.routeserviceid) !== undefined);
        res.status(200).json(online);
    })
    .catch((err) => {
        console.error({ error: err, path: '/online' });
        res.status(200).json([]);
    });
});

module.exports = router;
