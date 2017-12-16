const express = require('express');
const app = express();
const request = require('request');
const port = process.env.PORT || 3002;
const cluster = require('cluster');
require('dotenv').load();
const numCPUS = require('os').cpus().length;
const cache = {};
const cacheTimeout = 60000; //Cache results timeout after 60 seconds
const codeStrings = {
	200: 'is up',
	300: 'redirects',
	400: 'has a client error',
	500: 'has a server error',
};
//Ignore bad certificates -- this will be dealt with in another way in the future
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
//Enable getting IP of request
app.enable('trust proxy');


if (cluster.isMaster) {
	console.log(`Master ${process.pid} is running`);

	new Array(numCPUS).fill(0).forEach((on) => {
		cluster.fork();
	});

	cluster.on('exit', (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`);
	});
} else {
	const sendSiteHit = (site, code) => {
		const options = {
			url: `${process.env.STATS_URL}/${site}/inc`,
			method: 'POST',
			body: {
				auth: process.env.AUTH_TOKEN,
				code,
			},
			json: true,
			timeout: 5000,
		};
		console.log(`sending site hit to ${options.url}`);
		request(options, (error, response, body) => {
			if (error) {
				console.log(`error sending stats, ${error}`);
			}
		});
	};

	const checkUp = (url, callback) => {
		const options = {
			url,
			timeout: 10000, //Timeout after 10 seconds
		};
		request(options, (error, response, body) => {
			if (!error) {
				callback(response.statusCode);
			} else {
				console.error(error);
				callback(408);
			}
		});
	};

	//Save the url->code key->val in the cache.
	const cacheIt = (url, code) => {
		cache[url] = {
			time: new Date().getTime() / 1000,
			result: code,
		};
	};

	const checkCache = (url) => {
		//See if this url is in the cache
		if (cache[url]) {
			const timeCached = cache[url].time;
			const currentTime = new Date().getTime() / 1000;
			//See if the cache is recent enough
			if (currentTime - timeCached <= cacheTimeout) {
				return cache[url].result;
			}
		}
	};

	app.listen(port, () => {
		console.log(`Server listening on port ${port}`);
	});

	app.use(express.static('public'));

	app.get('/', (req, res) => {
		res.sendFile('public/index.html', { root: './' });
	});

	// For load-balancing tests.
	app.get('/loaderio-446a472e12c593ff0d019385c2c47066/', (req, res) => {
		res.send('loaderio-446a472e12c593ff0d019385c2c47066');
	});

	app.get('/site/*', (req, res) => {
		const target = req.url.substring(6);
		let url;
		if (target.includes('http://') || target.includes('https://')) {
			url = target;
		} else {
			url = `http://${target}`;
		}

		//See if we have a cached result.
		let cacheResult;
		if (cacheResult = checkCache(url)) {
			//See if the cached result was (OK) to determine if the site was up.
			const codeHundreds = parseInt(cacheResult/100)*100;
			const resultText = codeStrings[codeHundreds];
			res.send({
				resultText,
				code: cacheResult
			});
			console.log(`Sent: { resultText: "${resultText}", code: ${cacheResult} } to ${req.ip}`);
		//We didn't have a recent enough result in the cache.
		} else {
			//Check the url manually, cache the result.
			checkUp(url, (result) => {
				//Send the result.
				const codeHundreds = parseInt(result/100)*100;
				const resultText = codeStrings[codeHundreds];
				res.send({
					resultText,
					code: result
				});
				console.log(`Sent: { resultText: "${resultText}", code: ${result} } to ${req.ip}`);
				//Save this result.
				cacheIt(url, result);

				//Send a site request hit to the stats server
				sendSiteHit(req.url.substr(6), result);
			});
		}
	});

	console.log(`worker ${process.pid} started!`);

}
