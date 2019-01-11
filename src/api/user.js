const express = require('express');
const router = express.Router();

const db = require('../query');

router.post('/user', function(req, res, next) {
    const { userid } = req.body;
    if(!userid) {
        throw new Error('Invalid parameters');
    }

    db.createUser(userid)
    .then(() => {
        res.status(200).json({ success: true });
    })
    .catch((err) => {
        next(err);
    });
});

module.exports = router;