const express = require('express');
const router = express.Router();

const path = require('path');

router.get('/university', function(req, res, next) {
    res.sendFile(path.join('www/html/university.form.html'), { root: './' });
});

module.exports = router;
