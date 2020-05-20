const http = require('http');
const https = require('https');
const iconv = require('iconv-lite');
let reqTIMEOUT = 3000;
const resTIMEOUT = 5000;

function isHttps(host) {
    return /https/.test(host);
}

function get(options) {
    return new Promise((resolve, reject) => {
        let tid = 0;
        let adapter = isHttps(options.cprotocol) ? https : http;
        let req = adapter.request(options, function(res) {
            clearTimeout(tid);
            let resId = 0;
            let code = res.statusCode;
            //res.setEncoding('utf8');
            let rawData = '';
            if(code >= 300 && code < 400) {
                if(res.headers.location) {
                    options.cprotocol = isHttps(res.headers.location) ? 'https' : 'http';
                    options.credirect = options.credirect ? options.credirect + 1 : 1;
                    if(options.credirect > 3) {
                        return reject(new Error(`Redirect Max`));
                    }
                    if(res.headers.location.indexOf('http') > -1) {
                        try {
                            options.host = new URL(res.headers.location).host;
                        } catch(e) {
                            return reject(e);
                        }
                    } else {
                        options.host += res.headers.location;
                    }
                    return get(options).then(res => resolve(res)).catch(err => reject(err));
                } else {
                    return reject(new Error(`Redirect Failed`));
                }
            } else {
                resId = setTimeout(() => {
                    res.destroy();
                    reject(new Error('Response Timeout'));
                }, resTIMEOUT);
                let m;
                res.on('data', chunk => {
                    if(m = (chunk + '').match(/charset=(gb2312|gbk|big5)/i)) {
                        chunk = iconv.decode(chunk, m[1]);
                    }
                    rawData += chunk;
                });
                res.on('end', () => {
                    clearTimeout(resId);
                    resolve({data: rawData});
                });
                res.on('error', e => {
                    if(res.destroyed) return;
                    reject(e);
                });
            }
        });
        tid = setTimeout(() => {
            req.destroy();
            reject(new Error(`Request Timeout`));
        }, reqTIMEOUT);
        req.on('error', (e) => {
            if(req.destroyed) return;
            reject(e);
        });
        req.end();
    });
}

process.on('message', (arg) => {
    reqTIMEOUT = arg.timeout;
    get(arg.options).then(res => {
        process.send(res);
    }).catch(err => {
       process.send({message: err.message});
    });
});