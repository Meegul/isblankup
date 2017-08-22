const express = require('express');
const app = express();
const request = require('request');
const port = process.env.PORT || 3002;
const cluster = require('cluster');
require('dotenv').load();
const numCPUS = require('os').cpus().length;
const cache = {};
const cacheTimeout = 60000; //Cache results timeout after 60 seconds
const acceptedCodes = [200, 304];

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
				code: code
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
			url: url,
			timeout: 5000, //Timeout after 5 seconds
		};
		request(options, (error, response, body) => {
			if (!error) {
				callback(response.statusCode);
			} else {
				callback(404);
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
		const url = `http://${req.url.substr(6)}`;

		//See if we have a cached result.
		let cacheResult;
		if (cacheResult = checkCache(url)) {
			//See if the cached result was (OK) to determine if the site was up.
			const resultText = (acceptedCodes.includes(cacheResult)) ? 'up' : 'down';
			res.send(resultText);
		//We didn't have a recent enough result in the cache.
		} else {
			//Check the url manually, cache the result.
			checkUp(url, (result) => {
				//Send the result.
				const resultText = (acceptedCodes.includes(result)) ? 'up' : 'down';
				res.send(resultText);
				//Save this result.
				cacheIt(url, result);

				//Send a site request hit to the stats server
				sendSiteHit(req.url.substr(6), result);
			});
		}
	});

	console.log(`worker ${process.pid} started!`);

}
