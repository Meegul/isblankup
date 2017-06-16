# isblankup
A simple website to check if another website is up. It's been designed for high-load scenarios. To achieve this, it uses a basic caching system, the node.js cluster system, and keeps the amount of content it needs to serve to a minimum (only a few KB). On a free instance of Heroku, it manages over 1000 requests per second, with more powerful systems achieving even better results.

You can check it out at http://isblankup.com.

## Installing
Run `npm install && npm start` and you're good to go!
