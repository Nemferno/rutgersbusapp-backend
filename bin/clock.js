const { CronJob } = require('cron');

(function() {
    new CronJob({
        cronTime: '*/10 * * * * *',
        onTick: require('../src/worker/bus.prediction'),
        start: true,
        timeZone: 'America/New_York'
    });
})();
