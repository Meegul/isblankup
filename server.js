require('dotenv').config();
const express = require('express');
const cluster = require('cluster');
const { cpus } = require('os');

const port = process.env.PORT || 3002;
const CACHE_TTL_MS = 60_000;
const isDev = process.env.NODE_ENV === 'development';

// HTTP/2 omits status text, so we keep a fallback map for common codes
const STATUS_TEXTS = {
	400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
	404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout',
	410: 'Gone', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
	500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
	504: 'Gateway Timeout',
};

// Allow checking sites with self-signed or invalid certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (cluster.isPrimary && !isDev) {
	console.log(`Master ${process.pid} is running`);

	// Master holds the authoritative cache and fans updates out to all workers
	const sharedCache = {};

	cluster.on('message', (worker, msg) => {
		if (msg.type === 'cache:set') {
			sharedCache[msg.url] = msg.entry;
			for (const w of Object.values(cluster.workers)) {
				w.send({ type: 'cache:sync', url: msg.url, entry: msg.entry });
			}
		}
	});

	cpus().forEach(() => cluster.fork());

	cluster.on('exit', (worker) => {
		console.log(`Worker ${worker.process.pid} died, restarting`);
		cluster.fork();
	});
} else if (cluster.isWorker || isDev) {
	const localCache = {};

	process.on('message', (msg) => {
		if (msg.type === 'cache:sync') {
			localCache[msg.url] = msg.entry;
		}
	});

	const checkCache = (key) => {
		const entry = localCache[key];
		if (!entry) return null;
		if (Date.now() - entry.time > CACHE_TTL_MS) {
			delete localCache[key];
			return null;
		}
		return entry.result;
	};

	const cacheSet = (key, result) => {
		const entry = { time: Date.now(), result };
		localCache[key] = entry;
		if (cluster.isWorker) process.send({ type: 'cache:set', url: key, entry });
	};

	const checkSite = async (url) => {
		const start = Date.now();
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
			const responseTime = Date.now() - start;
			const { status: code, statusText: rawStatusText } = res;
			const statusText = rawStatusText || STATUS_TEXTS[code] || null;

			let resultText;
			if (code >= 200 && code < 300) resultText = 'is up';
			else if (code >= 400 && code < 500) resultText = 'is responding';
			else if (code >= 500) resultText = 'has server errors';
			else resultText = 'unknown status';

			// Normalize trailing slash before comparing to avoid noise
			const normalize = (u) => u.replace(/\/$/, '');
			const redirectedTo = normalize(res.url) !== normalize(url) ? res.url : null;

			return {
				resultText,
				code,
				statusText: code >= 400 ? statusText : null,
				responseTime,
				redirectedTo,
			};
		} catch (err) {
			const responseTime = Date.now() - start;
			if (err.name === 'TimeoutError') {
				return { resultText: 'timed out', code: null, statusText: null, responseTime, redirectedTo: null };
			}
			const errCode = err.cause?.code;
			if (errCode === 'ENOTFOUND' || errCode === 'EAI_NONAME') {
				return { resultText: 'not found', code: null, statusText: null, responseTime, redirectedTo: null };
			}
			if (errCode === 'ECONNREFUSED') {
				return { resultText: 'not responding', code: null, statusText: null, responseTime, redirectedTo: null };
			}
			return { resultText: 'could not connect', code: null, statusText: null, responseTime, redirectedTo: null };
		}
	};

	// Try HTTPS first when no protocol is given; fall back to HTTP on connection failure
	const checkSiteWithFallback = async (target) => {
		if (/^https?:\/\//i.test(target)) return checkSite(target);
		const result = await checkSite(`https://${target}`);
		// ENOTFOUND means the domain doesn't exist — HTTP won't help
		if (result.code === null && result.resultText !== 'not found') {
			return checkSite(`http://${target}`);
		}
		return result;
	};

	const sendSiteHit = (site, code) => {
		if (!process.env.STATS_URL) return;
		fetch(`${process.env.STATS_URL}/${site}/inc`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ auth: process.env.AUTH_TOKEN, code }),
			signal: AbortSignal.timeout(5_000),
		}).catch((err) => console.error('Stats error:', err.message));
	};

	const app = express();

	app.use(express.static('public'));

	app.get('/', (req, res) => {
		res.sendFile('public/index.html', { root: './' });
	});

	app.get('/site/*', async (req, res) => {
		const target = req.params[0];

		const cached = checkCache(target);
		if (cached !== null) {
			return res.json(cached);
		}

		const result = await checkSiteWithFallback(target);
		cacheSet(target, result);
		sendSiteHit(target, result.code);

		res.json(result);
	});

	app.listen(port, () => {
		console.log(`Worker ${process.pid} listening on port ${port}`);
	});
}
