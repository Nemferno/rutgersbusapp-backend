
/**
 * @constructor
 */
function StopTime(route, stop, bus, time, minutes) {
    this.route = route;
    this.stop = stop;
    this.bus = bus;
    this.time = time;
    this.minutes = minutes;
}

module.exports = { StopTime };
