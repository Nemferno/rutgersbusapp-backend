
function Vehicle(name, id, routeTag, lat, lon, speed, heading, capacity, lastUpdated) {
    this.name = name;
    this.id = Number.parseInt(id);
    this.routeTag = routeTag;
    this.lat = lat;
    this.lon = lon;
    this.speed = speed;
    this.heading = heading;
    this.lastUpdated = lastUpdated;
    this.capacity = capacity;
    this.event = 0;
    this.breakStart = null;
}
Vehicle.prototype.break = function() {
    if(this.onBreak()) return;

    this.breakStart = Date.now();
    this.event = 0b0001;
}
Vehicle.prototype.run = function() {
    if(!this.onBreak()) return;

    this.event = 0;
}
Vehicle.prototype.onBreak = function() {
    return this.event & 0b0001 === 0b0001;
}

/**
 * Converts JSON to Vehicle
 * @returns {Vehicle}
 */
Vehicle.parse = function(props) {
    const _props = [ 'name', 'id', 'routeTag', 'lat', 'lon', 'speed', 'heading', 'lastUpdated', 'capacity' ];
    for(let i in _props) {
        if(!props.hasOwnProperty(i))
            return null;
    }

    let vehicle = new Vehicle(props.name, props.id, props.routeTag, props.lat, props.lon, props.speed, props.heading, props.capacity, props.lastUpdated);
    vehicle.event = props.event;
    vehicle.breakStart = Date.parse(props.breakStart);

    return vehicle;
}

module.exports = { Vehicle };
