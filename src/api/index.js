const express = require('express');
const router = express.Router();

router.use('/', require('./vehicle'));

module.exports = router;
