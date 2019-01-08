const express = require('express');
const router = express.Router();

const { UniversityConfigController } = require('../adapter/uniconfigcontroller');
const { UniversityConfig } = require('../adapter/uniconfig');

const db = require('../query');

const { CacheObject } = require('../memcache');
const cache = new CacheObject();

router.get('/time', function(req, res, next) {
    let { unid, routeid, stopid } = req.query;
    if(!unid || !routeid || !stopid) {
        throw new Error('Invalid parameters!');
    }

    let config = null;
    UniversityConfigController.get(unid)
    .then((_config) => {
        config = _config;
        return config.getStopTimes(routeid, stopid);
    })
    .then((e) => {
        res.status(200).json(e);
    })
    .catch((err) => {
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
        res.status(200).json(e);
    })
    .catch((err) => {
        console.error({ err: err });
        res.status(500).json(null);
    });
});

module.exports = router;