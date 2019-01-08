
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
    return vehicle;
}

module.exports = { Vehicle };
