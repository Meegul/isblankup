const express = require("express");
const app = express();
const request = require("request");
const pug = require("pug");
const compiledSite = pug.compileFile("public/site.pug");
const compiledIndex = pug.compileFile("public/index.pug");
const port = 3000;

const cache = {};

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

app.get("/", (req, res) => {
    res.send(compiledIndex());
});

app.get("/site/*", (req, res) => {
    const path = req.path.substring(6);
    const url = `http://${path}`;
    let cacheResult;
    if (cacheResult = checkCache(url)) { //See if we have a cached result.
        console.log(`Got ${url}, code: ${cacheResult}, from cache.`);
        const resultText = (cacheResult === 200) ? " is up." : " is down.";
        res.send(compiledSite({
            site: path,
            code: cacheResult,
            text: resultText
        }));
    } else { //We didn't have a recent enough result in the cache.
        checkUp(url, (result) => {
            console.log(`${url}: ${result}`);
            const resultText = (result === 200) ? " is up." : " is down.";
            res.send(compiledSite({
                site: path,
                code: result,
                text: resultText
            }));
            cacheIt(url, result); //Save this result.
        });
    }
});

const checkUp = (url, callback) => {
    request(url, (error, response, body) => {
        if (!error)
            callback(response.statusCode);
        else callback(404);
    });
};

function cacheIt(url, code) {
    const timeChecked = (new Date()).getTime();
    cache[url] = {
        time: timeChecked,
        result: code
    };
}

function checkCache(url) {
    if (cache[url]) {
        const timeLastChecked = cache[url].time;
        const currentTime = (new Date()).getTime();
        if (currentTime - timeLastChecked <= 60000) //See if this was checked in the last minute.
            return cache[url].result;
        else return undefined;
    } else return undefined;
}