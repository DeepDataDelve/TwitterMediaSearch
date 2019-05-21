//Get twitter bearer token dynamically
require('dotenv').config();

const request = require('request-promise');
const credentials = `${process.env.TWITTER_CONSUMER_KEY}:${process.env.TWITTER_CONSUMER_SECRET}`;
const credentialsBase64Encoded = new Buffer(credentials).toString('base64');
request({
	url: 'https://api.twitter.com/oauth2/token',
	method:'POST',
	headers: {
	'Authorization': `Basic ${credentialsBase64Encoded}`,
	'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'
	},
	body: 'grant_type=client_credentials'
}, function(err, resp, body) {
	// set the bearer token ...
	var obj = JSON.parse(body);
	console.log("inside scope " + obj.access_token);
	process.env.TWITTER_BEARER_TOKEN=obj.access_token;
})
//console.log("outside scope " + bearerToken); // the bearer token ...

module.exports = getTwitterBT;