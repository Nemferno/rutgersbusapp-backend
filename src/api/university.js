const express = require('express');
const router = express.Router();

const db = require('../query');

// router.post('/university', function(req, res, next) {
//     const {
//         uniname, uniaddress, unizip,
//         zipcity, zipstate, zipcode
//     } = req.body;
    
//     if(unizip === 'null') {
//         db.addZipCode(zipcode, zipcity, zipstate)
//         .then(() => {
//             return db.addUniversity(uniname, uniaddress, zipcode);
//         })
//         .then(() => {
//             res.status(201).json({ status: 'success' });
//         })
//         .catch((err) => {
//             next(err);
//         });
//     } else {
//         db.addUniversity(uniname, uniaddress, unizip)
//         .then(() => {
//             res.status(201).json({ status: 'success' });
//         })
//         .catch((err) => {
//             next(err);
//         });
//     }
// });

module.exports = router;