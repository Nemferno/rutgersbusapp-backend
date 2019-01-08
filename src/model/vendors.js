const API_KEY = process.env.TRANSLOC_API;

const https = require('https');
const fs = require('fs');

const { StopTime } = require('../model/time');
const { Vehicle } = require('../model/vehicle');

const db = require('../query');

function VendorAdapter(props) {
    Object.defineProperties(this, {
        vendorname: {
            value: props.vendorname,
            writable: true,
            enumerable: true,
        },
        serviceid: {
            value: props.serviceid,
            writable: true,
            enumerable: true,
        }
    });
}
VendorAdapter.prototype.getName = function() { return this.vendorname; }
VendorAdapter.prototype.times = function(route, stop) { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.vehicles = function() { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.stops = function() { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.config = function() { return Promise.reject('Uninitialized function'); }
VendorAdapter.prototype.serialize = function() {
    return JSON.stringify({
        vendorname: this.vendorname,
        serviceid: this.serviceid
    });
}
VendorAdapter.parse = function(object) {
    const data = { vendorname, serviceid } = object;
    return new VendorAdapter(data);
}

TranslocAdapter = function() {
    VendorAdapter.apply(this, arguments);

    this.times = function(route, stop) {
        let isArray = false;
        if(stop.constructor.name === 'Array') {
            isArray = true;
            stop = stop.join(encodeURIComponent('&'));
        }

        return new Promise((resolve, reject) => {
            let request = https.request({
                port: 443,
                host: 'transloc-api-1-2.p.mashape.com',
                method: 'GET',
                headers: {
                    "X-Mashape-Key": API_KEY,
                    "Accept": "application/json"
                },
                path: `/arrival-estimates.json?agencies=${ this.serviceid }&routes=${ route }&stops=${ stop }`
            }, (res) => {
                let body = "";
                res.on('data', function(data) { body += data });
                res.on('end', () => {
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
                path: '/vehicles.json?agencies=' + this.serviceid
            }, (res) => {
                let body = "";
                res.on('data', function(data) { body += data });
                res.on('end', () => {
                    let json = JSON.parse(body);
                    let data = json.data[this.serviceid];
                    let vehicles = [];

                    if(!data) return resolve(vehicles);
                    for(let i = 0; i < data.length; i++) {
                        let item = data[i];
                        const { call_name, vehicle_id, route_id, location, speed, heading, last_updated_on, passenger_load } = item;
                        let v = new Vehicle(call_name, vehicle_id, route_id, location.lat, location.lng, speed, heading, passenger_load, last_updated_on);
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
    const data = { vendorname, serviceid } = object;
    return new TranslocAdapter(data);
}

module.exports = { VendorAdapter, TranslocAdapter };
