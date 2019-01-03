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
    if(!unid || !route) {
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
        if(route) {
            payload = e.filter(e => e.routeTag === route);
        } else {
            payload = (busid) ? e.filter(e => e.name === busid) : e;
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

    const today = new Date();
    db.getOnlineRoutes(today.toDateString(), unid)
    .then((data) => {
        res.status(200).json(data);
    })
    .catch((err) => {
        console.error({ error: err, path: '/online' });
        res.status(200).json([]);
    });
});

module.exports = router;
