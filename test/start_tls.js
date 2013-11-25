var smtp = require('../');
var tls = require('tls');
var net = require('net');
var fs = require('fs');
var test = require('tap').test;
var concat = require('concat-stream');
var split = require('split');

var keys = {
    key: fs.readFileSync(__dirname + '/keys/key.pem'),
    cert: fs.readFileSync(__dirname + '/keys/cert.pem'),
    ca: fs.readFileSync(__dirname + '/keys/ca.pem')
};

test('server upgrade to TLS', function (t) {
    t.plan(5);
    
    var opts = {
        domain: 'beep',
        key: keys.key,
        cert: keys.cert
    };
    var server = smtp.createServer(opts, function (req) {
        req.on('tls', function () {
console.log('TLS');
            t.ok(true, 'upgraded to tls');
        });
        
        req.on('from', function (from, ack) {
            t.equal(from, 'beep@a.com');
            ack.accept();
        });
        
        req.on('to', function (to, ack) {
            t.equal(to, 'boop@b.com');
            ack.accept();
        });
        
        req.on('message', function (stream, ack) {
            stream.pipe(concat(function (body) {
                t.equal(body, 'oh hello');
            }));
            ack.accept();
        });
        
        return server;
    });
    server.listen(0, function () {
        var stream = net.connect(server.address().port);
        
        var steps = [
            function () {
                stream.write('ehlo beep\n');
            },
            function () {
                stream.write('starttls\n');
            },
            function () {
                var tstream = tls.connect({
                    servername: 'localhost',
                    socket: stream,
                    ca: keys.ca
                });
                
                tstream.on('secureConnection', function (sec) {
console.log('SECURE');
                    t.ok(true, 'secure connection established');
                    sec.pipe(concat(function (body) {
                        console.log(body);
                    }));
                    sec.write('mail from: <beep@a.com>\n');
                    sec.write('rcpt to: <boop@b.com>\n');
                    sec.write('data\nbeep boop\n.\nquit\n')
                });
            }
        ];
        
        var ix = -1;
        stream.pipe(split()).on('data', function ondata (line) {
            if (/^\d{3}(\s|$)/.test(line)) {
                var f = steps[++ix];
                if (f) return f()
                this.removeListener('data', ondata);
            }
        });
    });
});