const express = require('express');
const router = express.Router();

router.get('/', function(req, res) {
    res.status(200).send('Api Ping');
});

router.use('/', require('./vehicle'));
router.use('/', require('./zipcode'));
router.use('/', require('./university'));
router.use('/tools', require('./tools'));

module.exports = router;
