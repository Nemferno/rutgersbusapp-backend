
const { CacheObject } = require('../memcache');
const { UniversityConfig } = require('./uniconfig');
const cache = new CacheObject();

function UniversityConfigController(){}
/**
 * Gets the configuration for the university
 * @returns {Promise<UniversityConfig>}
 */
UniversityConfigController.get = function(id) {
    let config = null;
    return new Promise((resolve, reject) => {
        cache.get(`configs.${id}`, function(err, data) {
            if(err) return reject(err);
            
            return resolve(data);
        });
    }).then(function(data) {
        if(data) {
            // parse data
            try {
                config = UniversityConfig.parse(JSON.parse(data));
            } catch(err) {
                console.error({ error: err });
                config = new UniversityConfig(id);
            }
        } else {
            // if null, create config
            config = new UniversityConfig(id);
        }

        return (typeof config.ready === 'function') ? config.ready() : config.ready;
    }).then(function() {
        // 1 hour expiration
        cache.set(`configs.${id}`, config.serialize(), { expires: 60 * 60 });
        return Promise.resolve(config);
    });
}

module.exports = { UniversityConfigController };
