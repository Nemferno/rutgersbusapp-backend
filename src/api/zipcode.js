const express = require('express');
const router = express.Router();

const db = require('../query');

router.get('/zipcodes', function(req, res, next) {
    db.getZipCodes()
    .then((codes) => {
        res.status(200).json(codes);
    })
    .catch((err) => {
        console.error({ error: err });
        res.status(500).json([]);
    });
});

module.exports = router;