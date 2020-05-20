const ws = require('nodejs-websocket');
const http = require('http');
const https = require('https');
const {fork} = require('child_process');
let domain = [];
let count = 0;
let total = 0;
let M = 10;
let timeout = 3000;

const server = ws.createServer(connection => {
    connection.on('text', function(result) {
        let data = JSON.parse(result);
        if(data.stop) {
            connection.hadErr = 1;
            return connection.sendText(JSON.stringify({end: 1}));
        }
        connection.hadErr = 0;
        count = 0;
        total = 0;
        domain = [];
        timeout = data.timeout;
        M = data.number;
        if(data.rand) {
            domain = randDomain();
        } else {
            domain = parseDomain(data.domain);
        }
        trigger(connection);
    });
    connection.on('connect', function(code) {
    });
    connection.on('close', function(code) {
    });
    connection.on('error', function(code) {
        connection.hadErr = 1;
    });
}).listen(3001);

function randRange(m, n) {
    return m + Math.random() * (n - m + 1) | 0;
}

function getRandChar() {
    let a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return a[Math.random() * a.length | 0];
}

function getRandDomainShuffix() {
    let c = ['cc', 'net', 'com', 'vip', 'wang'];
    return c[Math.random() * c.length | 0];
}

function randDomain() {
    let n = 1000, m, s, arr = [];
    while(n--) {
        m = randRange(2, 8);
        s = '';
        while(m--) {
            s += getRandChar();
        }
        arr.push(`www.${s}.${getRandDomainShuffix()}`);
    }
    return arr;
}

function trigger(connection) {
    if(connection.hadErr) return;
        let len = domain.length;
        count = 0;
        total = len >= M ? M : len;
        let dos = domain.splice(0, total);
        for(let i = 0; i < total; i++) {
            createChildProess(dos[i], connection);
        }
}

function parseDomain(domain) {
    let reg = /\[\d+\-\d+\]/;
    let m = domain.match(reg);
    if(m) {
        m = m[0].match(/(\d+)/g);
        if(m.length !== 2) return [domain];
        let start = Number(m[0]);
        let end = Number(m[1]);
        let arr = [];
        while(start <= end) {
            arr.push(domain.replace(reg, start));
            start++;
        }
        return arr;
    }
    return [domain];
}

function decode(t) {
    return t.replace(/&#(\d+);/g, function(a, b) {
        return String.fromCharCode(b);
    })
}

async function createChildProess(param, connection) {
    let ob = {host: 'http://' + param};
    let options = {
        method: 'get',
        host: param,
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36',
            'accept': 'text/html'
        }
    };
    let child = fork('./request.js');
    child.on('message', res => {
        child.kill();
        count++;
        ob.end = domain.length === 0 && count === total;
        let title;
        if(res && typeof res.data === 'string') {
            title = res.data.match(/<title>(.*)<\/title>/i);
            if(title) {
                if(/&#\d+;/.test(title[1])) {
                    title[1] = decode(title[1]);
                }
                ob.title = title[1];
                ob.isHad = true;
            }
        }
        if(res.message) {
            ob.err = res.message;
        }
        !connection.hadErr && connection.sendText(JSON.stringify(ob));
        if(count === total && domain.length) {
            trigger(connection);
        }
    });
    child.send({options: options, timeout: timeout});
}
