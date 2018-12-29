const API_KEY = process.env.TRANSLOC_API;

const https = require('https');
const fs = require('fs');

const { StopTime } = require('../model/time');
const { Vehicle } = require('../model/vehicle');

function VendorAdapter(name, props) {
    this.defineProperties(this, {
        name: {
            value: name,
            writable: false,
            enumerable: true,
        },
        props: {
            value: props,
            writable: false,
            enumerable: true,
        }
    });
}
VendorAdapter.prototype.getName = function() { return this.name; }
VendorAdapter.prototype.get = function(key) { return this.props[key]; }
VendorAdapter.prototype.times = function(route, stop) { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.vehicles = function() { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.stops = function() { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.config = function() { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.serialize = function() {
    return JSON.stringify({
        name: this.name,
        props: this.props
    });
}
VendorAdapter.parse = function(object) {
    const { name, props } = JSON.parse(object);
    return new VendorAdapter(name, props);
}

TranslocAdapter = function() {
    VendorAdapter.apply(this, arguments);

    this.times = function(route, stop) {
        return new Promise((resolve, reject) => {
            let request = https.request({
                port: 443,
                host: 'transloc-api-1-2.p.mashape.com',
                method: 'GET',
                headers: {
                    "X-Mashape-Key": API_KEY,
                    "Accept": "application/json"
                },
                path: `/arrival-estimates.json?agencies=${ this.props["agency_id"] }&routes=${ route }&stops=${ stop }`
            }, function(res) {
                let body = "";
                res.on('data', function(data) { body += data });
                res.on('end', function() {
                    let json = JSON.parse(body);
                    let data = json.data;

                    let payload = {};
                    for(let i = 0; i < data.length; i++) {
                        let item = data[i];
                        let times = {};
                        for(let j = 0; j < item.arrivals.length; j++) {
                            let arrival = item.arrivals[j];
                            let date = new Date(arrival['arrival_at']);
                            let offset = Math.floor((date.getTime() - Date.now()) / (60 * 1000));

                            let id = arrival['route_id'];
                            if(!times[id]) times[id] = [];

                            let time = new StopTime(id, item['stop_id'], item['vehicle_id'], item['arrival_at'], offset);
                            times[id].push(time);
                        }

                        payload[item['stop_id']] = times;
                    }

                    resolve(payload);
                });
            });
            request.on('error', function(err) {
                reject(err);
            });
            request.end();
        });
    };
    this.vehicles = function() {
        return new Promise((resolve, reject) => {
            let request = https.request({
                port: 443,
                host: 'transloc-api-1-2.p.mashape.com',
                method: 'GET',
                headers: {
                    "X-Mashape-Key": API_KEY,
                    "Accept": "application/json"
                },
                path: '/vehicles.json?agencies=' + this.props["agency_id"]
            }, function(res) {
                let body = "";
                res.on('data', function(data) { body += data });
                res.on('end', function() {
                    let json = JSON.parse(body);
                    let data = json.data[this.props["agency_id"]];
                    let vehicles = [];

                    if(!data) return resolve(vehicles);
                    for(let i = 0; i < data.length; i++) {
                        let item = data[i];
                        const { call_name, vehicle_id, route_id, location, speed, heading, last_updated_on } = item;
                        let v = new Vehicle(call_name, vehicle_id, route_id, location.lat, location.lng, speed, heading, last_updated_on);
                        vehicles.push(v);
                    }

                    resolve(vehicles);
                });
            });
            request.on('error', function(err) {
                reject(err);
            });
            request.end();
        });
    }
}
TranslocAdapter.prototype = VendorAdapter.prototype;
TranslocAdapter.parse = function(object) {
    const { name, props } = JSON.parse(object);
    return new TranslocAdapter(name, props);
}

module.exports = { VendorAdapter, TranslocAdapter };
