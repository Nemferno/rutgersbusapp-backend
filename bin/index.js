#!usr/bin/env node
const ENV = process.env.NODE_ENV;
if(ENV === 'dev') {
    require('dotenv').config();

    console.info({ 'node-env': ENV });
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('morgan');
const path = require('path');

const API_VERSION = process.env.PATH_VERSION;
const ROOT_PATH = process.env.ROOT_PATH;
const FULL_PATH = '/' + API_VERSION + ROOT_PATH;
console.log({ path: FULL_PATH });

const app = express();

app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(FULL_PATH, require('../src/api/index'));

app.get('/', function(req, res) {
    res.status(200).send('Ping');
});

app.use('/', express.static(path.join('www')));

app.use(function(req, res, next) {
    let err = new Error('Page Not Found');
    Object.defineProperty(err, 'status', {
        value: 404,
        writable: false,
        enumerable: true
    });
    next(err);
});
app.use(function(err, req, res, next) {
    console.error({ error: err });
    res.locals.message = (ENV === 'dev') ? err.message : '';
    res.locals.error = (ENV === 'dev') ? err : {};

    res.status(err.status || 500);
    res.send(res.locals.error);
});

const debug = require('debug')('uninav-server');
const http = require('http');

const PORT = normalizePort(process.env.PORT || '5000');
app.listen(PORT);

function normalizePort(value) {
    let port = parseInt(value, 10);
    if(isNaN(port)) return value;
    if(port >= 0) return port;

    return false;
}
