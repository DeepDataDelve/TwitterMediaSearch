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
var userTagsModel = require('../models/UserTagsSchema');
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

function parseTwitterDate(aDate)
{   
  return new Date(Date.parse(aDate.replace(/( \+)/, ' UTC$1')));
}

// test functions /////////////////////////////////////////////////////////////////////////////////
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

router.get('/timer', function (req, res) {
	var ts = Math.round(new Date().getTime() / 1000);
	console.log("Current timestamp: "+ts)
	var tsYesterday = ts - (24 * 3600);
	var loggedIn = false;
	//get credentials first
	console.log("Current timestamp -24h: "+tsYesterday)
	var daysTracked = req.get('days_tracked');
	if (daysTracked)
	{
		let sub_days = parseInt(daysTracked);
		console.log("Days to search backwards: " + daysTracked);
		tsYesterday = ts - (24 * 3600 * sub_days);
		console.log("Current timestamp -"+daysTracked+" days: "+tsYesterday)
	}
	res.send(200);
});

router.put('/test/fs/', function (req, res) {
	//initialize variables
	var resultSet = [];
	var ts = Math.round(new Date().getTime() / 1000);
	var tsYesterday = ts - (24 * 3600);
	//BEGIN LOGIC:
	fs.readFile('usernames.txt', function(err, data) {
		if(err) throw err;
		var array = data.toString().split(/\r?\n/);
		for(i in array) {
			console.log(array[i]);
		}
		res.status(200).send(array.length.toString() + " users");
	});
});

//PUBLIC USE ROUTES: /////////////////////////////////////////////////////////////////////////////////////////

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
			let mediaType = "text";
			if(media.hashtags)
			{
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media)
			{
				let extractedMedia = media.media[0].media_url;
				if(extractedMedia.includes("video_thumb"))
				{
					mediaType = "video";
				}
				else
				{
					mediaType = "image";
				}
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
			let mediaType = "text";
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
				let extractedMedia = media.media[0].media_url;
				if(extractedMedia.includes("video_thumb"))
				{
					mediaType = "video";
				}
				else
				{
					mediaType = "image";
				}
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

//ADMIN ONLY COMMANDS: //////////////////////////////////////////////////////////////////////////////////////////////////////////

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
//auth check
var loggedIn = false;
var adminName = process.env.ADMIN_NAME;
var adminPW = process.env.ADMIN_PW;
if(req.get('login_name') === adminName && req.get('password') === adminPW)
{
	loggedIn = true;
}
if(loggedIn == true)
{
//BEGIN LOGIC:
	client.get('search/tweets', fparams, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.statuses.some(function(tweet) {
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			if(timeStamp < tsYesterday){return true;}
			let media = tweet.entities;
			let mediaType = "text";
			if(media.hashtags)
			{
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media)
			{
				let extractedMedia = media.media[0].media_url;
				if(extractedMedia.includes("video_thumb"))
				{
					mediaType = "video";
				}
				else
				{
					mediaType = "image";
				}
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
}
else
{
	return res.status(500).send("Unauthorized Access");
}
res.status(200).send();
});

// POSTS A SINGLE USER'S POSTS AND TYPE TO MONGO DB
router.post('/posts/user/:username', function (req, res) {
var ts = Math.round(new Date().getTime() / 1000);
var tsYesterday = ts - (24 * 3600);
//check auth
var loggedIn = false;
var adminName = process.env.ADMIN_NAME;
var adminPW = process.env.ADMIN_PW;
if(req.get('login_name') === adminName && req.get('password') === adminPW)
{
	loggedIn = true;
}
if(loggedIn == true)
{
	client.get('statuses/user_timeline', {screen_name: req.params.username, count: 200}, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.some(function(tweet) {
			var mediaType = "text";
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
				let extractedMedia = media.media[0].media_url;
				if(extractedMedia.includes("video_thumb"))
				{
					mediaType = "video";
				}
				else
				{
					mediaType = "image";
				}
			}		
			var stats = new tweetModel({
					userName: tweet.user.screen_name,
					retweets: tweet.retweet_count,
					replies: tweet.reply_count,
					quotes: tweet.quote_count,
					favorites: tweet.favorite_count,
					followers: tweet.user.followers_count,
					hashtags: tweet.entities.hashtags.text,
					media: mediaType,
					date: tweet.created_at
				});
			stats.save();
			console.log(tweet.created_at + " " + tweet.user.screen_name);
	   });
	   //console.log(statsSchema);
	});
	//END CLIENT GET	
	res.status(200).send();
}
else
{
	return res.status(500).send("Unauthorized Access");
}
res.status(200).send();
});

// POSTS ALL TRACKED USERS' META INFO TO MONGO DB
router.put('/posts/user/', function (req, res) {
//initialize variables
var resultSet = [];
var ts = Math.round(new Date().getTime() / 1000);
var tsYesterday = ts - (24 * 3600);
var loggedIn = false;
//get credentials first
var adminName = process.env.ADMIN_NAME;
var adminPW = process.env.ADMIN_PW;
var daysTracked = req.get('days_tracked');
if (daysTracked)
{
	console.log("Days to search backwards: " + daysTracked);
	let sub_days = parseInt(daysTracked);
	tsYesterday = ts - (24 * 3600 * sub_days);
	console.log(tsYesterday);
}
if(req.get('login_name') === adminName && req.get('password') === adminPW)
{
	loggedIn = true;
}
if(loggedIn == true)
{
	//BEGIN LOGIC:
	fs.readFile('usernames.txt', function(err, data) {
		if(err) throw err;
		var array = data.toString().split(/\r?\n/);
		for(i in array) {
			let username = array[i];
			console.log(username);	
			client.get('statuses/user_timeline', {screen_name: username, count: 200}, function(error, tweets, response) {
				if (error) console.log("There was a problem retrieving the tweets.");
				tweets.some(function(tweet) {
					 var mediaType = "text";
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
						 let extractedMedia = media.media[0].media_url;
						 if(extractedMedia.includes("video_thumb"))
						 {
							 mediaType = "video";
						 }
						 else
						 {
							 mediaType = "image";
						 }
					 }		
					 var stats = new tweetModel({
							 userName: tweet.user.screen_name,
							 retweets: tweet.retweet_count,
							 replies: tweet.reply_count,
							 quotes: tweet.quote_count,
							 favorites: tweet.favorite_count,
							 followers: tweet.user.followers_count,
							 hashtags: tweet.entities.hashtags.text,
							 media: mediaType,
							 date: tweet.created_at
						 });
					 stats.save();
					 console.log(username + ' ' + tweet.created_at);
				});
				//console.log(statsSchema);
			 });
			//fill the result set with each	
		} //END LOOP
		//if (err) return res.status(500).send("There was a problem retrieving the tweets.");
	});
	//END POST OPERATION
}
else
{
	return res.status(500).send("Unauthorized Access");
}
res.status(200).send();	
});

//Search MONGO DB
router.get('/data/user/:username', function (req, res) {
		var loggedIn = false;
		var adminName = process.env.ADMIN_NAME;
		var adminPW = process.env.ADMIN_PW;
		if(req.get('login_name') === adminName && req.get('password') === adminPW)
		{
			loggedIn = true;
		}
		if(loggedIn == true)
		{
			//get all entries matching username parameter
			var data = tweetModel.find({"userName" : req.params.username}).exec(function(err, users){
				if(err) return res.status(500).send(err);
				//users.sort((a,b)=>b.followers-a.followers);
				users.sort((a,b)=>
				new Date(b.date)- new Date(a.date)
				);
				return res.status(200).send(users);
			});
		}
		else
		{
			return res.status(500).send("Unauthorized Access");
		}
});
//add username to list to scheduled search
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

//remove username's entries from MONGODB
router.delete('/data/user/:username', function (req, res) {
	var loggedIn = false;
	var adminName = process.env.ADMIN_NAME;
	var adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW)
	{
		loggedIn = true;
	}
	if(loggedIn == true)
	{
		tweetModel.deleteMany({"userName" : req.params.username}, function(err, data) {
			if (err) {
				return res.status(500).send(err);
			} else {
				return res.status(200).send(req.params.username + " successfully deleted.");
			}
		  });
	}
	else
	{
		return res.status(500).send("Unauthorized Access");
	}
});

//add username with associated tags to the db
router.post('/data/tags/:username', function (req, res) {
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
		var userTags = userTagsModel({
			userName = req.get(userName),
			tags = req.get(tagsArray)			
		});
		userTags.save();
	}
	else
	{
		return res.status(500).send("Unauthorized Access");
	}
	res.status(200).send();
});

module.exports = router;