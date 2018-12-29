const { CacheObject } = require('../memcache');
const { TranslocAdapter, VendorAdapter } = require('../model/vendors');
const { NixleAlerter } = require('../nixle');
const cache = new CacheObject();

function UniversityConfig(id, ignore) {
    this.error = null;
    this.ready = this.init;
    /** @type {VendorAdapter} */
    this.adapter = null;

    this.id = id;
    this.name = '';
    ignore && this.init();
}

UniversityConfig.prototype.init = function() {
    let self = this;
    if(this.ready) return Promise.resolve();

    return new Promise((resolve, reject) => {
        fs.readFile(`university-configs/${ self.id }-config/adapter.config.json`, (err, data) => {
            if(err) {
                this.error = err;
                this.ready = Promise.reject();
                return reject(err);
            }

            let json = JSON.parse(data.toString());
            this.name = json.name;
            this.crime = { name, url } = json.crime;
            this.city = json.city_id;
            switch(json.vendor.name.toLowerCase()) {
                case "transloc":
                    this.adapter = new TransLocAdapter(json.vendor.name, json.vendor.others);
                    break;
                default:
                    this.adapter = new VendorAdapter(json.vendor.name, json.vendor.others);
            }

            resolve();
        });
    }).then(() => {
        this.ready = Promise.resolve();
    });
}
UniversityConfig.prototype.getName = function() { return this.name; }
UniversityConfig.prototype.getVendorName = function() { return this.adapter.getName(); }
UniversityConfig.prototype.getCity = function() { return this.city; }
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
UniversityConfig.prototype.getTimes = function(route, stop) {
    if(this.error) return Promise.reject('Cannot execute a malfunctioned configuration!');

    return new Promise((resolve, reject) => {
        cache.get(`${ this.id }_times_${route}_${stop}`, (err, data) => {
            if(err) return reject(err);

            resolve(data);
        });
    }).then((data) => {
        if(data) {
            return Promise.resolve(JSON.parse(data));
        } else {
            return { raw: true, data: this.adapter.times(route, stop) };
        }
    }).then((data) => {
        if(data.raw) {
            cache.set(`${ this.id }_times_${route}_${stop}`, JSON.stringify(data.data), { expires: 5 });
            data = data.data;
        }
        
        return Promise.resolve(data);
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
        error: this.error,
        name: this.name,
        id: this.id,
        adapter: this.adapter.serialize(),
        crime: this.crime,
        city: this.city,
        ready: (typeof this.ready)
    });
}
UniversityConfig.parse = function(value) {
    if(value.id && value.adapter && value.crime && value.city && value.name) {
        let config = new UniversityConfig(value.id, true);
        config.error = value.error;

        let adapter = JSON.parse(val.adapter);
        switch(adapter.name.toLowerCase()) {
            case 'transloc':
                config.adapter = TranslocAdapter.parse(adapter);
                break;
            default:
                config.adapter = VendorAdapter.parse(adapter);
        }

        if(value.ready === 'object')
            config.ready = (value.error) ? Promise.reject() : Promise.resolve();

        config.name = value.name;
        config.crime = value.crime;
        config.city = value.city;
        
        return config;
    }

    return null;
}

module.exports = { UniversityConfig };
