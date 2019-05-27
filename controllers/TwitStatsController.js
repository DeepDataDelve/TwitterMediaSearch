require('dotenv').config();
var express = require('express');
var router = express.Router();
var fs = require('fs');
var bodyParser = require('body-parser');
var Twitter = require('twitter');

//Import the mongoose module
var mongoose = require('mongoose');

//Set up default mongoose connection
var mongoDB = process.env.MONGO_SERVER_ADDRESS
mongoose.connect(mongoDB, { useNewUrlParser: true });

//Get the default connection
var db = mongoose.connection;

//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

//Get mongoose schema for tweets
var tweetModel = require('../models/TwitStats');
//START: TEST SCHEMA TO REDUCE JSON
const schema = require('schm')

const statsSchema = schema({
  userName: String,
	retweets: Number,
	replies: Number,
  quotes: Number,
  favorites: Number,
  followers: Number,
  hashtags: String,
  media: String,
  date: String
});
//END SCHEMA DEFINITION

var client = new Twitter({
	consumer_key: process.env.TWITTER_CONSUMER_KEY,
	consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	bearer_token: process.env.TWITTER_BEARER_TOKEN
  });

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// test function
router.get('/test', function (req, res) {
	console.log(client);
	client.get('search/tweets', {q: '#ios #iphone', count: 10}, function(error, tweets, response) {
		if (error) return res.status(500).send("There was a problem retrieving the tweets.");
		tweets.statuses.forEach(function(tweet) {console.log("tweet: " + tweet.text)});
		res.send(JSON.stringify(tweets.statuses));
	})

	let name = 'test_USER';
	testOut = tweetModel.findOne({name: new RegExp('^'+name+'$', "i")}, function(err, doc) {
  console.log(testOut);
	});

});

router.post('/test', function (req, res) {
	let ts = Math.round(new Date().getTime() / 1000);
	var stats = new tweetModel({
			userName: "Test_USER"+ts,
			retweets: (Math.floor(Math.random() * Math.floor(999))),
			replies: (Math.floor(Math.random() * Math.floor(999))),
			quotes: (Math.floor(Math.random() * Math.floor(999))),
			favorites: (Math.floor(Math.random() * Math.floor(999))),
			followers: (Math.floor(Math.random() * Math.floor(999))),
			hashtags: "#testing",
			media: "text",
			date: new Date().toISOString()
		});
	console.log(stats.userName);
	stats.save(function (err) {
		if (err) return handleError(err);
		// saved!
	});
	console.log("data saved to mongo!");
	res.status(200).send();
});

// GETS A SINGLE USER'S POSTS FROM TWITTER (DEBUG VER, TO BE REMOVED)
router.get('/debug/user/:username', function (req, res) {
	var resultSet = [];
	client.get('statuses/user_timeline', {screen_name: req.params.username, count: 50}, function(error, tweets, response) {
		   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
		   tweets.some(function(tweet) {
				console.log("user: " + tweet.user.name);
				console.log("tweet: " + tweet.text);	
				let timeStamp = Math.round(new Date(tweet.created_at))/1000;
				let ts = Math.round(new Date().getTime() / 1000);
				var tsYesterday = ts - (24 * 3600);
				let media = tweet.entities;
				console.log("tags:" + JSON.stringify(tweet.entities.hashtags));
				console.log("media:" + JSON.stringify(tweet.entities.media));
				if(media.hashtags)
				{
					var tags = "";
					for(var key in media.hashtags) {
						tags+=(media.hashtags[key]["text"] + " ");
					}
					console.log(tags);
				}
				if(media.media)
				{
					var mediaType = media.media[0].media_url;
					console.log(mediaType);
				}
				console.log(timeStamp + " " + ts);
				if(timeStamp < tsYesterday){return true;}
				var stats = statsSchema.parse({
						userName: tweet.user.screen_name,
						retweets: tweet.retweet_count,
						replies: tweet.reply_count,
						quotes: tweet.quote_count,
						favorites: tweet.favorite_count,
						followers: tweet.user.followers_count,
						hashtags: tags,
						media: mediaType,
						date: tweet.created_at,
					});
				resultSet.push(stats);
		   });
		   console.log(resultSet.length);
		   res.status(200).send(resultSet);
		});
		//END CLIENT GET	
	});

// GETS A SINGLE TOPIC'S POSTS FROM TWITTER
router.get('/posts/topic/:topic', function (req, res) {
var resultSet = [];
var ts = Math.round(new Date().getTime() / 1000);
var tsYesterday = ts - (24 * 3600);
var fparams = {
  q: req.params.topic,
  count: 50,
  result_type: 'recent',
  lang: 'en'
}
	client.get('search/tweets', fparams, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.statuses.some(function(tweet) {
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			let media = tweet.entities;
			if(media.hashtags)
			{
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media)
			{
				var mediaType = media.media[0].media_url;
			}			
			if(timeStamp < tsYesterday){return true;} //stop parsing tweets once we hit something from before the last 24H
			
			var stats = statsSchema.parse({
					userName: tweet.user.screen_name,
					retweets: tweet.retweet_count,
					replies: tweet.reply_count,
					quotes: tweet.quote_count,
					favorites: tweet.favorite_count,
					followers: tweet.user.follower_count,
					hashtags: tags,
					media: mediaType,
					date: tweet.created_at,
				});
			resultSet.push(stats);
	   });
	   console.log(resultSet.length);
	   res.status(200).send(resultSet);
	});
	//END CLIENT GET
});

// GETS A SINGLE USER'S POSTS FROM TWITTER
router.get('/posts/user/:username', function (req, res) {
var resultSet = [];
var ts = Math.round(new Date().getTime() / 1000);
var tsYesterday = ts - (24 * 3600);
client.get('statuses/user_timeline', {screen_name: req.params.username, count: 200}, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.some(function(tweet) {
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			if(timeStamp < tsYesterday){return true;}
			let media = tweet.entities;
			if(media.hashtags)
			{
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media)
			{
				var mediaType = media.media[0].media_url;
			}
			var stats = statsSchema.parse({
					userName: tweet.user.screen_name,
					retweets: tweet.retweet_count,
					replies: tweet.reply_count,
					quotes: tweet.quote_count,
					favorites: tweet.favorite_count,
					followers: tweet.user.followers_count,
					hashtags: tags,
					media: mediaType,
					date: tweet.created_at,
				});
			resultSet.push(stats);
	   });
	   console.log(resultSet.length);
	   res.status(200).send(resultSet);
	});
	//END CLIENT GET	
});

// POSTS A SINGLE TOPIC'S POSTS AND TYPE TO MONGO DB
router.post('/posts/topic/:topic', function (req, res) {
//parameters for the search

var fparams = {
  q: req.params.topic,
  count: 100,
  result_type: 'recent',
  lang: 'en'
}
//other variables
var ts = Math.round(new Date().getTime() / 1000);
var tsYesterday = ts - (24 * 3600);
//BEGIN LOGIC:
	client.get('search/tweets', fparams, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.statuses.some(function(tweet) {
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			if(timeStamp < tsYesterday){return true;}
			let media = tweet.entities;
			if(media.hashtags)
			{
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media)
			{
				var mediaType = media.media[0].media_url;
			}
			var stats = new tweetModel({
					userName: tweet.user.screen_name,
					retweets: tweet.retweet_count,
					replies: tweet.reply_count,
					quotes: tweet.quote_count,
					favorites: tweet.favorite_count,
					followers: tweet.user.followers_count,
					hashtags: tags,
					media: mediaType,
					date: tweet.created_at
				});
			stats.save();
	   });
	});
	//END CLIENT GET
	res.status(200).send();
});

// POSTS A SINGLE USER'S POSTS AND TYPE TO MONGO DB
router.post('/posts/user/:username', function (req, res) {
	var ts = Math.round(new Date().getTime() / 1000);
    var tsYesterday = ts - (24 * 3600);
	client.get('statuses/user_timeline', {screen_name: req.params.username, count: 200}, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.some(function(tweet) {
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			if(timeStamp < tsYesterday){return true;} //break out if tweets are older than 24h
			let media = tweet.entities;
			if(media.hashtags)
			{
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media)
			{
				var mediaType = media.media[0].media_url;
			}			
			var stats = new tweetModel({
					userName: tweet.user.screen_name,
					retweets: tweet.retweet_count,
					replies: tweet.reply_count,
					quotes: tweet.quote_count,
					favorites: tweet.favorite_count,
					followers: tweet.user.followers_count,
					hashtags: tweet.entities.hashtags.text,
					media: tweet.entities.media.type,
					date: tweet.created_at
				});
			stats.save();
			console.log(tweet.created_at);
	   });
	   //console.log(statsSchema);
	});
	//END CLIENT GET	
	res.status(200).send();
});

// POSTS ALL TRACKED USERS' META INFO TO MONGO DB
router.put('/posts/user/', function (req, res) {
	//initialize variables
	var resultSet = [];
	var ts = Math.round(new Date().getTime() / 1000);
	var tsYesterday = ts - (24 * 3600);
	//BEGIN LOGIC:
	fs.readFile('usernames.txt', function(err, data) {
		if(err) throw err;
		var array = data.toString().split("\n");
		for(username in array) {
			//fill the result set with each
			client.get('statuses/user_timeline', {screen_name: username, count: 200}, function(error, tweets, response) {
				if (error) return res.status(500).send("There was a problem retrieving the tweets.");
				let timeStamp = Math.round(new Date(tweet.created_at))/1000;
				tweets.some(function(tweet) {
						if(timeStamp < tsYesterday){return true;}
						let media = tweet.entities;
						if(media.hashtags)
						{
							var tags = "";
							for(var key in media.hashtags) {
								tags+=(media.hashtags[key]["text"] + " ");
							}
						}
						if(media.media)
						{
							var mediaType = media.media[0].media_url;
						}
						var stats = new tweetModel({
								userName: tweet.user.screen_name,
								retweets: tweet.retweet_count,
								replies: tweet.reply_count,
								quotes: tweet.quote_count,
								favorites: tweet.favorite_count,
								followers: tweet.user.followers_count,
								hashtags: tags,
								media: mediaType,
								date: tweet.created_at
							});
						stats.save(); //save each tweet's metadata to our collection
				});
			 });
			 //END CLIENT GET	
		} //END LOOP
		res.status(200).send();
	});
	//END POST OPERATION	
});

//ADMIN ONLY COMMANDS:
router.post('/data/list/:username', function (req, res) {
		var loggedIn = false;
		var adminName = process.env.ADMIN_NAME;
		var adminPW = process.env.ADMIN_PW;
		if(req.get('login_name') === adminName && req.get('password') === adminPW)
		{
			loggedIn = true;
		}
		if(loggedIn == true)
		{
			//adds username to list of usernames to search in the automated PUT function
			fs.appendFile('usernames.txt', (req.params.username+'\n'), (err) => {
			console.log(err);	
			});
		}
		else
		{
				return res.status(500).send("Unauthorized Access");
		}
		res.status(200).send();
});

router.delete('/data/list/:username', function (req, res) {
	var loggedIn = false;
	var adminName = process.env.ADMIN_NAME;
	var adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW)
	{
		loggedIn = true;
	}
	if(loggedIn == true)
	{
		tweetModel.find({ userName: req.params.username }, (err, user) => { 
			if (err) throw err;
					// delete this person's entries
					user.remove(function(err) {
						if (err) throw err;				
						console.log('User successfully deleted!');
					});
		});
	}
	else
	{
			return res.status(500).send("Unauthorized Access");
	}
	res.status(200).send();
});

module.exports = router;