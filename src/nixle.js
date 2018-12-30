
const cheerio = require('cheerio');

function convertToDate(high, low) {
    let date = new Date();

    this.adjust(date, high.value, high.unit);
    this.adjust(date, low.value, low.unit);

    return date.toLocaleDateString('en-US');
}

function adjust(date, value, unit) {
    switch(unit) {
        case 'year':
            date.setFullYear(date.getFullYear() - value);
            break;
        case 'month':
            date.setMonth(date.getMonth() - value);
            break;
        case 'week':
            date.setDate(date.getDate() - (value * 7));
            break;
        case 'day':
            date.setDate(date.getDate() - value);
            break;
        case 'hour':
            date.setHours(date.getHours() - value);
            break;
        case 'minute':
            date.setMinutes(date.getMinutes() - value);
            break;
    }
}

function NixleAlerter(){}
NixleAlerter.getCrimeAlerts = function(url) {
    return new Promise(function(resolve, reject) {
        let request = https.get({
            port: 443,
            host: 'local.nixle.com',
            method: 'GET',
            path: '/messagewidget' + url
        }, function(res) {
            let body = '';
            res.on('data', function(chunk) {
                body += chunk;
            });
            res.on('end', function() {
                const $ = cheerio.load(body, {
                    xml: {
                        normalizeWhitespace: true
                    }
                });
                let alerts = [];
                
                $('li').each(function(i, elem) {
                    let payload = {};
                    let _spans = elem.children.filter(e => e.tagName === 'span');
                    if(_spans.length === 0) return;

                    let _span = _spans[0];
                    payload.type = $(_span).text();
            
                    let _ps = elem.children.filter(e => e.tagName === 'p');
                    for(let i = 0; i < _ps.length; i++) {
                        let p = _ps[i];
                        let content = $(p).text();
                        if(i === 0) {
                            payload.heading = content.substring(0, content.indexOf('More')).trim();
                            payload.href = $('a', p).attr('href');
                        } else {
                            let _colon = content.indexOf(':');
                            let _sub   = content.substring(_colon + 1, content.length - 1).trim();
                            let splits = _sub.replace(',', '').split(' ');

                            // 2 weeks 4 days ago
                            // [2, weeks, 4, days, ago]
                            let high = {
                                unit: (splits[1].charAt(splits[1].length - 1) === 's') ? splits[1].substring(0, splits[1].length - 1) : splits[1],
                                value: Number.parseInt(splits[0])
                            };
    
                            let low = { unit: 'year', value: 0 };
                            if(splits.length > 3) {
                                low = {
                                    unit: (splits[3].charAt(splits[3].length - 1) === 's') ? splits[3].substring(0, splits[3].length - 1) : splits[3],
                                    value: Number.parseInt(splits[2])
                                };
                            }
    
                            payload.date = self.convertToDate(high, low);
                        }
                    }
    
                    alerts.push(payload);
                });

                resolve(alerts);
            });
        });
        request.on('error', (err) => reject(err));
        request.end();
    });
}

module.exports = { NixleAlerter };
