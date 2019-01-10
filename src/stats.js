
function StatModule() {}

/**
 * Gives a logic result if the bus is on break
 * @returns {boolean}
 */
StatModule.isOnBreak = function(duration) {
    const probability = -0.077820309+0.005038471 * duration;
    return probability >= 0.7;
};

module.exports = { StatModule };
