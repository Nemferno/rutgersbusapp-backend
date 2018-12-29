
function Vehicle(name, id, routeTag, lat, lon, speed, heading, lastUpdated) {
    this.name = name;
    this.id = id;
    this.routeTag = routeTag;
    this.lat = lat;
    this.lon = lon;
    this.speed = speed;
    this.heading = heading;
    this.lastUpdated = lastUpdated;
}

/**
 * Converts JSON to Vehicle
 * @returns {Vehicle}
 */
Vehicle.parse = function(props) {
    const _props = [ 'name', 'id', 'routeTag', 'lat', 'lon', 'speed', 'heading', 'lastUpdated' ];
    for(let i in _props) {
        if(!props.hasOwnProperty(i))
            return null;
    }

    let vehicle = new Vehicle(props.name, props.id, props.routeTag, props.lat, props.lon, props.speed, props.heading, props.lastUpdated);
    return vehicle;
}

module.exports = { Vehicle };
