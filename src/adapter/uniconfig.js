const { CacheObject } = require('../memcache');
const { TranslocAdapter, VendorAdapter } = require('../model/vendors');
const { Vehicle } = require('../model/vehicle');
const { NixleAlerter } = require('../nixle');
const cache = new CacheObject();
const db = require('../query');

function UniversityConfig(id) {
    this.error = null;
    this.ready = this.init;
    /** @type {VendorAdapter} */
    this.adapter = null;

    this.id = this.name = id;
}

UniversityConfig.prototype.init = function() {
    let self = this;

    return db.getUniversity(this.id)
    .then((data) => {
        data = data[0];

        if(data) {
            const payload = { serviceid, vendorname } = data;
            switch(data.vendorname.toLowerCase()) {
                case "transloc":
                    this.adapter = new TranslocAdapter(payload);
                    break;
                default:
                    this.adapter = new VendorAdapter(payload);
            }

            return Promise.resolve();
        } else {
            this.error = new Error(`No data about university, ${ this.id }, exists...`);
            this.ready = Promise.reject();
            return Promise.reject(this.error);
        }
    }).then(() => {
        this.ready = Promise.resolve();
    });
}
UniversityConfig.prototype.getName = function() { return this.name; }
UniversityConfig.prototype.getVendorName = function() { return this.adapter.getName(); }
UniversityConfig.prototype.getCity = function() { return this.city; }
/** @returns {Promise<Vehicle[]>} */
UniversityConfig.prototype.getVehicles = function() {
    if(this.error) return Promise.reject('Cannot execute a malfunctioned configuration!');

    // do not handle setting memcache
    return new Promise((resolve, reject) => {
        cache.get(`${ this.id }_buses`, (err, data) => {
            if(err) return reject(err);

            resolve(data ? JSON.parse(data) : []);
        });
    });
}
UniversityConfig.prototype.getStopTimes = function(route, stop) {
    if(this.error) return Promise.reject('Cannot execute a malfunctioned configuration!');

    return new Promise((resolve, reject) => {
        cache.get(`${ this.id }_times_${route}_${stop}`, (err, data) => {
            if(err) return reject(err);

            resolve(data);
        });
    }).then((data) => {
        if(data) {
            return JSON.parse(data);
        } else {
            return { raw: true, data: this.adapter.times(route, stop) };
        }
    }).then((data) => {
        if(data.raw) {
            cache.set(`${ this.id }_times_${route}_${stop}`, JSON.stringify(data.data), { expires: 5 });
            data = data.data;
        }
        
        return data;
    });
}
UniversityConfig.prototype.getRouteTimes = function(route) {
    if(this.error) return Promise.reject('Cannot execute a malfunctioned configuration!');

    return new Promise((resolve, reject) => {
        cache.get(`${ this.id }_times_${route}`, (err, data) => {
            if(err) return reject(err);

            resolve(data);
        });
    })
    .then((data) => {
        if(data) {
            return JSON.parse(data);
        } else {
            return db.getRouteStops(route, this.id)
            .then((data) => {
                let stopservices = data.map(e => e.stopserviceid);
                return { raw: true, data: this.adapter.times(route, stopservices) };
            });
        }
    })
    .then((data) => {
        if(data.raw) {
            cache.set(`${ this.id }_times_${route}`, JSON.stringify(data.data), { expires: 5 });
            data = data.data;
        }

        return data;
    });
}
UniversityConfig.prototype.getCrimeAlerts = function() {
    if(this.error) return Promise.reject('Cannot execute a malfunctioned configuration!');

    return new Promise((resolve, reject) => {
        cache.get(`${ this.id }_crimes`, (err, data) => {
            if(err) return reject(err);

            resolve(data);
        });
    }).then((data) => {
        if(data) {
            return Promise.resolve(data);
        } else {
            return { raw: true, data: NixleAlerter.getCrimeAlerts() };
        }
    }).then((data) => {
        if(data.raw) {
            cache.set(`${ this.id }_crimes`, JSON.stringify(data.data), { expires: 60 * 60 });
            data = data.data;
        }

        return Promise.resolve(data);
    });
}
UniversityConfig.prototype.serialize = function() {
    return JSON.stringify({
        name: this.name,
        id: this.id,
        adapter: this.adapter.serialize(),
        ready: (typeof this.ready)
    });
}
UniversityConfig.parse = function(value) {
    if(value.id && value.adapter && value.name) {
        let config = new UniversityConfig(value.id);
        config.error = value.error;

        let adapter = JSON.parse(value.adapter);
        switch(adapter.vendorname.toLowerCase()) {
            case 'transloc':
                config.adapter = TranslocAdapter.parse(adapter);
                break;
            default:
                config.adapter = VendorAdapter.parse(adapter);
        }

        if(value.ready === 'object')
            config.ready = (value.error) ? Promise.reject() : Promise.resolve();

        config.name = value.name;

        return config;
    }

    return null;
}

module.exports = { UniversityConfig };
