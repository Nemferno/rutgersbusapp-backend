const express = require('express');
const router = express.Router();

const db = require('../query');

router.get('/stops', function(req, res, next) {
    let { unid } = req.query;
    if(!unid) {
        throw new Error('Invalid parameters!');
    }

    db.getAllStops(unid)
    .then((data) => {
        res.status(200).json(data);
    })
    .catch((err) => {
        console.error({ error: err, path: '/stops' });
        res.status(500).json(null);
    });
});
router.get('/config', function(req, res, next) {
    let { unid, routeid } = req.query;
    if(!unid || !routeid) {
        throw new Error('Invalid parameters!');
    }

    db.getRouteConfiguration(routeid, unid)
    .then((data) => {
        let payload = data[0];

        res.status(200).json(payload ? payload : null);
    })
    .catch((err) => {
        console.error({ error: err, path: '/config' });
        res.status(500).json(null);
    })
});
router.get('/routes', function(req, res, next) {
    let { unid } = req.query;
    if(!unid) throw new Error('Invalid parameters!');

    db.getAllRoutes(unid)
    .then((data) => {
        res.status(200).json(data);
    })
    .catch((err) => {
        console.error({ error: err, path: '/routes' });
        res.status(500).json(null);
    });
});

module.exports = router;