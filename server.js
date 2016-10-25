const express = require("express");
const app = express();
const request = require("request");
const pug = require("pug");
const compiledSite = pug.compileFile("public/site.pug");
const compiledIndex = pug.compileFile("public/index.pug");
const port = 3000;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

app.get("/", (req, res) => {
    res.send(compiledIndex());
});

app.get("/*", (req, res) => {
    const path = req.path.substring(1);
    const url = `http://${path}`;
    checkUp(url, (result) => {
        console.log(`${url}: ${result}`);
        const resultText = (result === 200) ? " is up." : " is down.";
        res.send(compiledSite({
            site: path,
            code: result,
            text: resultText
        }));
    });
});

const checkUp = (url, callback) => {
    request(url, (error, response, body) => {
        if (!error)
            callback(response.statusCode);
        else callback(404);
    });
};