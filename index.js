const ws = require('nodejs-websocket');
const http = require('http');
const https = require('https');
const {fork} = require('child_process');
let count = 0;
let M = 10;
let stop = true;
let domain = '';
let isInfinite = true;
let timeout = 3000;
let domainList = [];
const SF = ['cc', 'net', 'com', 'vip', 'wang', 'com.cn', 'cn', 'tv', 'org', 'top', 'xyz'];
const CHAR = 'abcdefghijklmnopqrstuvwxyz';
const CHARNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

const server = ws.createServer(connection => {
    connection.on('text', function(result) {
        let data = JSON.parse(result);
        stop = false;
        if(data.stop) {
            stop = true;
            return;
        }
        connection.hadErr = 0;
        timeout = data.timeout;
        M = data.number;
        genDomain(data.rule, data.shuffix);
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

function genDomain(rule, shuffix) {
    let c = [], g = [];
    if(!shuffix) c.push(SF.length);
    shuffix = shuffix ? shuffix : '%h';
    g.push('www.');
    rule.forEach(d => {
       if(d.value) return g.push(d.value);
       if(d.type === '1') {
           c.push(36);
           g.push('%r');
       } else if(d.type === "2") {
           c.push(10);
           g.push('%d');
       } else {
           c.push(26);
           g.push('%s');
       }
    });
    g.push('.');
    g.push(shuffix);
   if(c.reduce((p, n) => p * n) > 100000) {
       isInfinite = true;
       domain = g.join('');
   } else {
       isInfinite = false;
       genDomainList(g);
   }
}

function genDomainList(g) {
    let code = [], s = [];
    for(let i = 0; i < g.length; i++) {
        if(g[i] === '%r') {
            code.push(CHARNUM.split(''));
            s.push({index: 0, s: i, len: CHARNUM.length});
        } else if(g[i] === '%s') {
            code.push(CHAR.split(''));
            s.push({index: 0, s: i, len: CHAR.length});
        } else if(g[i] === '%d') {
            code.push([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            s.push({index: 0, s: i, len: 10});
        } else if(g[i] === '%h') {
            code.push(SF);
            s.push({index: 0, s: i, len: SF.length});
        } else {
            code.push(g[i]);
        }
    }
    let str = '';
    function find(i) {
        for(let it of s) {
            if(it.s === i) {
                return it;
            }
        }
    }
    domainList = [];
    while(1) {
        str = '';
        for(let i = 0; i < code.length; i++) {
            if(code[i] instanceof Array) {
                str += code[i][find(i).index];
            } else {
                str += code[i];
            }
        }
        domainList.push(str);
        let b = 0;
        for(let j = s.length - 1; j >= 0; j--) {
            if(j === s.length - 1) {
                b = 1;
            }
            if(b) {
                b = 0;
                s[j].index++;
                if(s[j].index === s[j].len && s[0].index < s[0].len) {
                    s[j].index = 0;
                    b = 1;
                }
            }
        }
        if(s[0].index === s[0].len) {
            break;
        }
    }
}

function randCharNumber() {
    return CHARNUM[Math.random() * CHARNUM.length | 0];
}

function randChar() {
    return CHAR[Math.random() * CHAR.length | 0];
}

function randShuffix() {
    return SF[Math.random() * SF.length | 0];
}

function randDomain() {
    if(isInfinite) {
        return domain.replace(/%r|%d|%s|%h/g, a => {
            if(a === '%r') {
                return randCharNumber();
            } else if(a === '%d') {
                return Math.random() * 10 | 0;
            } else if(a === '%s') {
                return randChar();
            } else if(a === '%h') {
                return randShuffix();
            }
        });
    } else {
        return domainList.pop();
    }
}

function trigger(connection) {
    count = M;
    for(let i = 0; i < M; i++) {
        createChildProess(connection);
    }
}

function decode(t) {
    return t.replace(/&#(\d+);/g, function(a, b) {
        return String.fromCharCode(b);
    })
}

async function createChildProess(connection) {
    let child = fork('./request.js', {windowsHide: true});
    let host;
    child.on('message', res => {
        let title, ob = {};
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
        ob.host = `http://${res.host}`;
        if(!connection.hadErr) {
            connection.sendText(JSON.stringify(ob));
            if(stop) {
                kill();
            } else {
                host = randDomain();
                if(host) {
                    child.send({host: host});
                } else {
                    kill();
                }
            }
        } else {
            kill();
        }
    });
    function kill() {
        child.kill();
        count--;
        if(count === 0) {
            connection.sendText(JSON.stringify({end: 1}));
        }
    }
    host = randDomain();
    if(host) {
        child.send({host: host, timeout: timeout});
    } else {
        kill();
    }
}
