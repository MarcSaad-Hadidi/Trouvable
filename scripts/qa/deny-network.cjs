// Loaded only in the disposable Next child via NODE_OPTIONS. No service credentials are inherited.
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');
const net = require('node:net');
const tls = require('node:tls');
const { syncBuiltinESMExports } = require('node:module');
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const fonts = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const ports = new Set((process.env.TROUVABLE_QA_PORTS || '').split(',').filter(Boolean));
const allowFonts = process.env.TROUVABLE_QA_ALLOW_FONTS === '1';

function check(host, port) {
    host = String(host || 'localhost').toLowerCase().replace(/^\[|\]$/g, '');
    if (localHosts.has(host) && (port === undefined || ports.has(String(port)))) return;
    if (allowFonts && fonts.has(host) && (port === undefined || String(port) === '443')) return;
    const error = new Error(`QA blocked network destination: ${host}${port === undefined ? '' : `:${port}`}`);
    error.code = 'QA_NETWORK_BLOCKED';
    const out = process.env.TROUVABLE_QA_ARTIFACTS;
    if (out) fs.appendFileSync(path.join(out, 'server-network-blocked.log'), `${error.message}\n`);
    throw error;
}
function destination(args, defaultPort) {
    let first = args[0];
    if (Array.isArray(first)) first = first[0]; // Node's normalized Socket.connect arguments.
    if (first instanceof URL || typeof first === 'string' && /^https?:/.test(first)) {
        const url = new URL(first);
        return [url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80)];
    }
    if (typeof first === 'number') return [typeof args[1] === 'string' ? args[1] : 'localhost', first];
    if (typeof first === 'string') throw new Error('QA does not permit Unix socket connections');
    if (first?.path && !first.host && !first.hostname && !first.port) throw new Error('QA does not permit Unix socket connections');
    return [first?.hostname || first?.host || 'localhost', first?.port ?? defaultPort];
}
const fetchOriginal = globalThis.fetch;
globalThis.fetch = function (input, ...args) {
    try {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
        check(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80));
    } catch (error) {
        return Promise.reject(error);
    }
    return fetchOriginal.call(this, input, ...args);
};
for (const [moduleName, defaultPort] of [['node:http', 80], ['node:https', 443]]) {
    const transport = require(moduleName);
    for (const name of ['request', 'get']) {
        const original = transport[name];
        transport[name] = function (...args) {
            check(...destination(args, defaultPort));
            // An options argument can override the hostname/port in a URL.
            if ((typeof args[0] === 'string' || args[0] instanceof URL) && typeof args[1] === 'object') {
                const [host, port] = destination(args, defaultPort);
                check(args[1].hostname || args[1].host || host, args[1].port ?? port);
            }
            return original.apply(this, args);
        };
    }
}
for (const [transport, name] of [[net, 'connect'], [net, 'createConnection'], [net.Socket.prototype, 'connect'], [tls, 'connect']]) {
    const original = transport[name];
    transport[name] = function (...args) {
        check(...destination(args));
        return original.apply(this, args);
    };
}
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']) {
    const original = dns[name];
    dns[name] = function (host, ...args) {
        try { check(host); } catch (error) {
            const callback = args.at(-1);
            if (typeof callback === 'function') return process.nextTick(() => callback(error));
            throw error;
        }
        return original.call(this, host, ...args);
    };
    const promiseOriginal = dns.promises[name];
    dns.promises[name] = async function (host, ...args) {
        check(host);
        return promiseOriginal.call(this, host, ...args);
    };
}
// Resolver instances must not bypass the module-level DNS hooks.
for (const prototype of [dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const name of ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']) {
        const original = prototype[name];
        prototype[name] = function (host, ...args) {
            try { check(host); } catch (error) {
                const callback = args.at(-1);
                if (typeof callback === 'function') return process.nextTick(() => callback(error));
                if (prototype === dns.promises.Resolver.prototype) return Promise.reject(error);
                throw error;
            }
            return original.call(this, host, ...args);
        };
    }
}
syncBuiltinESMExports();
