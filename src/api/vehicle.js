const express = require('express');
const router = express.Router();

const { UniversityConfigController } = require('../adapter/uniconfigcontroller');
const { UniversityConfig } = require('../adapter/uniconfig');

const db = require('../query');

const { CacheObject } = require('../memcache');
const cache = new CacheObject();

// Vehicle API Only
router.get('/bus', function(req, res, next) {
    let { unid, busid, route } = req.query;
    if(!unid || !busid || !route) {
        throw new Error('Invalid parameters!');
    }

    /** @type {UniversityConfig} */
    let config = null;
    UniversityConfigController.getConfig(unid)
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

    /** @type {UniversityConfig} */
    let config = null;
    UniversityConfigController.getConfig(unid)
    .then((_config) => {
        config = _config;
        return new Promise((resolve, reject) => {
            cache.get(`${ unid }_online`, (err, data) => {
                if(err) {
                    return reject(err);
                }

                resolve(data ? JSON.parse(data) : []);
            });
        });
    })
    .then((data) => {
        // access database to get route information
        async.map(data, (item, cb) => {
            db.getRoute(item, unid)
            .then((info) => {
                let load = { routeid, name, direction } = info;
                cb(null, load);
            })
            .catch((err) => {
                cb(null, {});
            });
        }, (err, results) => {
            if(err) { results = []; }

            res.status(200).json(results);
        });
    })
    .catch((err) => {
        next(err);
    });
});

module.exports = router;
