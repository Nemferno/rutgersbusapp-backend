const express = require('express');
const router = express.Router();

const db = require('../query');

router.get('/reminders', function(req, res, next) {
    const { userid } = req.query;

    db.getActiveRemindersFor(userid)
    .then((data) => {
        res.status(200).json(data);  
    })
    .catch((err) => {
        next(err);
    });
});
router.post('/reminder', function(req, res, next) {
    const { unid, startdate, reminderduration, routeid, stopid, userid } = req.body;

    db.createReminder(userid, startdate, reminderduration, stopid, routeid, unid)
    .then(() => {
        res.status(200).json({ success: true });
    })
    .catch((err) => {
        next(err);
    });
});
router.delete('/reminder/:userid/:id', function(req, res, next) {
    const { userid, id } = req.params;

    db.deleteReminder(userid, id)
    .then(() => {
        res.status(200).json({ success: true });
    })
    .catch((err) => {
        next(err);
    });
});
router.put('/reminder', function(req, res, next) {
    const { userid, reminderid, duration } = req.body;

    db.updateReminderByUser(userid, reminderid, duration)
    .then(() => {
        res.status(200).json({ success: true });
    })
    .catch((err) => {
        next(err);
    });
});

module.exports = router;