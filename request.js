const http = require('http');
const https = require('https');
const iconv = require('iconv-lite');
const {detectEncoding} = require('char-encoding-detector');
let reqTIMEOUT = 3000;
const resTIMEOUT = 5000;
let options = {
    method: 'get',
    headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36',
        'accept': 'text/html'
    }
};

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
            if(code >= 300 && code < 400) {
                if(res.headers.location) {
                    options.cprotocol = isHttps(res.headers.location) ? 'https' : 'http';
                    options.credirect = options.credirect ? options.credirect + 1 : 1;
                    if(options.credirect > 3) {
                        return reject(new Error(`Redirect Max`));
                    }
                    if(res.headers.location.indexOf('http') > -1) {
                        try {
                            let url = new URL(res.headers.location);
                            options.host = url.host;
                            options.path = url.pathname;
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
                if(code === 200) {
                    let rawData = Buffer.alloc(0);
                    resId = setTimeout(() => {
                        res.destroy();
                        reject(new Error('Response Timeout'));
                    }, resTIMEOUT);
                    res.on('data', chunk => {
                        rawData = Buffer.concat([rawData, chunk], rawData.length + chunk.length);
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
    if(arg.timeout) {
        reqTIMEOUT = arg.timeout;
    }
    options.host = arg.host;
    get(options).then(res => {
        process.send({data: iconv.decode(res.data, detectEncoding(res.data) || 'gb2312'), host: options.host});
    }).catch(err => {
        process.send({message: err.message, host: options.host});
    });
});