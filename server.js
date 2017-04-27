const express = require('express');
const app = express();
const request = require('request');
const port = process.env.PORT || 3001;
const cluster = require('cluster');
const numCPUS = require('os').cpus().length;
const cache = {};
const cacheTimeout = 60000; //Cache results timeout after 60 seconds

if (cluster.isMaster) {
	console.log(`Master ${process.pid} is running`);

	new Array(numCPUS).fill(0).forEach((on) => {
		cluster.fork();
	});

	cluster.on('exit', (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`);
	});
} else {
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
			time: new Date().getTime(),
			result: code,
		};
	};

	const checkCache = (url) => {
		//See if this url is in the cache
		if (cache[url]) {
			const timeCached = cache[url].time;
			const currentTime = (new Date()).getTime();
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

	app.get('/site/:url', (req, res) => {
		const url = `http://${req.params.url}`;

		//See if we have a cached result.
		let cacheResult;
		if (cacheResult = checkCache(url)) {
			//See if the cached result was code 200 (OK) to determine if the site was up.
			const resultText = (cacheResult === 200) ? 'up' : 'down';
			res.send(resultText);
		//We didn't have a recent enough result in the cache.
		} else {
			//Check the url manually, cache the result.
			checkUp(url, (result) => {
				//Send the result. Code 200 (OK) === site is up.
				const resultText = (result === 200) ? 'up' : 'down';
				res.send(resultText);
				//Save this result.
				cacheIt(url, result);
			});
		}
	});

	console.log(`worker ${process.pid} started!`);

}
