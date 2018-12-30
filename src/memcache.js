const ENV = process.env.NODE_ENV;
if(ENV === 'dev') {
    require('dotenv').config();
}

const memjs = require('memjs');

const config = {
    keepAlive: true,
    retries: 4,
    failover: true
};

function CacheObject() {
    this.path = (ENV === 'dev') ? 'dev_' : '';
    this.client = memjs.Client.create(null, config);
}

CacheObject.prototype.restart = function() {
    this.close();
    this.client = memjs.Client.create(null, config);
}

CacheObject.prototype.close = function() { this.client.close(); };
CacheObject.prototype.get = function(key, callback) {
    callback = callback || function(err, value) {};
    this.client.get(this.path + key, function(err, data) {
        if(err) {
            console.error({ error: err });
            this.validateError(err);

            return callback(err, null);
        }

        callback(null, (data) ? data.toString() : null);
    });
}
CacheObject.prototype.set = function(key, value, options, callback) {
    options = options || { expires: 60 };
    callback = callback || function(err) {};
    this.client.set(this.path + key, value, options, function(err) {
        if(err) {
            console.error({ error: err });
            this.validateError(err);

            return callback(err);
        }

        callback(null);
    });
}
CacheObject.prototype.replace = function(key, value, options, callback) {
    options = options || { expires: 60 };
    callback = callback || function(err) {};
    this.client.set(this.path + key, value, options, function(err, success) {
        if(err) {
            console.error({ error: err });
            this.validateError(err);

            return callback(err);
        }

        callback(null);
    });
}
CacheObject.prototype.delete = function(key, callback) {
    callback = callback || function(err) {};
    this.client.delete(key, function(err, success) {
        if(err) {
            console.error({ error: err });
            this.validateError(err);

            return callback(err);
        }

        callback(null);
    });
}
CacheObject.prototype.validateError = function(err) {
    if(err.message.trim() === 'No Servers available')
        this.restart();
}

module.exports = { CacheObject };
