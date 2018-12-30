
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
            config = UniversityConfig.parse(JSON.parse(data));
        } else {
            // if null, create config
            config = new UniversityConfig(id);
        }

        return config.ready();
    }).then(function() {
        // 1 hour expiration
        memcache.set(`configs.${uniId}`, config.serialize(), { expires: 60 * 60 });
        return resolve(config);
    });
}

module.exports = { UniversityConfigController };
