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
  date: String,
  text: String,
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

router.put('/test/fs/', function (req, res) {
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
router.get('/posts/topic/:topic/:daysBack?', function (req, res) {
	var resultSet = [];
	//time stamp variables
	let ts = Math.round(new Date().getTime() / 1000);
	let tsPastDate = ts - (24 * 3600); //yesterday by default
	let daysBack = parseInt(req.params.daysBack);
	if (req.params.daysBack && !isNaN(daysBack)){
		tsPastDate = ts - (24 * 3600 * daysBack);
	}
	//params for twitter search
	var fparams = {
	q: req.params.topic,
	count: 100,
	result_type: 'recent',
	lang: 'en'
	}
	client.get('search/tweets', fparams, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.statuses.some(function(tweet) {
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			let media = tweet.entities;
			let mediaType = "text";
			if(media.hashtags){
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media){
				let extractedMedia = media.media[0].media_url;
				if(extractedMedia.includes("video_thumb")){
					mediaType = "video";
				}
				else{
					mediaType = "image";
				}
			}
			if(timeStamp < tsPastDate){return true;} //stop parsing tweets once we hit something from before the last 24H
			
			let stats = statsSchema.parse({
					userName: tweet.user.screen_name,
					retweets: tweet.retweet_count,
					replies: tweet.reply_count,
					quotes: tweet.quote_count,
					favorites: tweet.favorite_count,
					followers: tweet.user.follower_count,
					hashtags: tags,
					media: mediaType,
					date: tweet.created_at,
					text: tweet.text.substring(0,100),
				});
			resultSet.push(stats);
	   });
	   console.log(resultSet.length);
	   res.status(200).send(resultSet);
	});
	//END CLIENT GET
});

// GETS A SINGLE USER'S POSTS FROM TWITTER
router.get('/posts/user/:username/:daysBack?', function (req, res) {
	var resultSet = [];
	//timestamp calculations
	let ts = Math.round(new Date().getTime() / 1000);
	let tsPastDate = ts - (24 * 3600); //yesterday by default
	let daysBack = parseInt(req.params.daysBack);
	if (req.params.daysBack && !isNaN(daysBack)){
		tsPastDate = ts - (24 * 3600 * daysBack);
	}
	//BEGIN get from twitter API
	client.get('statuses/user_timeline', {screen_name: req.params.username, count: 200}, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.some(function(tweet) {
			let mediaType = "text";
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			if(timeStamp < tsPastDate){return true;}
			let media = tweet.entities;
			if(media.hashtags){
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media){
				let extractedMedia = media.media[0].media_url;
				if(extractedMedia.includes("video_thumb")){
					mediaType = "video";
				}
				else{
					mediaType = "image";
				}
			}

			let stats = statsSchema.parse({
					userName: tweet.user.screen_name,
					retweets: tweet.retweet_count,
					replies: tweet.reply_count,
					quotes: tweet.quote_count,
					favorites: tweet.favorite_count,
					followers: tweet.user.followers_count,
					hashtags: tags,
					media: mediaType,
					date: tweet.created_at,
					text: tweet.text.substring(0,100),
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
router.post('/posts/topic/:topic/:daysBack?', function (req, res) {
	//parameters for the search
	var fparams = {
	q: req.params.topic,
	count: 100,
	result_type: 'recent',
	lang: 'en'
	}
	//other variables
	let ts = Math.round(new Date().getTime() / 1000);
	let tsPastDate = ts - (24 * 3600); //yesterday by default
	let daysBack = parseInt(req.params.daysBack);
	if (req.params.daysBack && !isNaN(daysBack)){
		tsPastDate = ts - (24 * 3600 * daysBack);
	}
	//auth check
	let loggedIn = false;
	const adminName = process.env.ADMIN_NAME;
	const adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW){
		loggedIn = true;
	}
	if(loggedIn == true){
	//BEGIN LOGIC:
		client.get('search/tweets', fparams, function(error, tweets, response) {
		if (error) return res.status(500).send("There was a problem retrieving the tweets.");
		tweets.statuses.some(function(tweet) {
				let timeStamp = Math.round(new Date(tweet.created_at))/1000;
				if(timeStamp < tsPastDate){return true;}
				let media = tweet.entities;
				let mediaType = "text";
				if(media.hashtags){
					var tags = "";
					for(var key in media.hashtags) {
						tags+=(media.hashtags[key]["text"] + " ");
					}
				}
				if(media.media){
					let extractedMedia = media.media[0].media_url;
					if(extractedMedia.includes("video_thumb")){
						mediaType = "video";
					}
					else{
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
router.post('/posts/user/:username/:daysBack?', function (req, res) {
	let ts = Math.round(new Date().getTime() / 1000);
	let tsPastDate = ts - (24 * 3600);
	let daysBack = parseInt(req.params.daysBack);
	if (req.params.daysBack && !isNaN(daysBack)){
		tsPastDate = ts - (24 * 3600 * daysBack);
	}
	//check auth
	let loggedIn = false;
	const adminName = process.env.ADMIN_NAME;
	const adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW){
		loggedIn = true;
	}
	if(loggedIn == true){
	client.get('statuses/user_timeline', {screen_name: req.params.username, count: 200}, function(error, tweets, response) {
	   if (error) return res.status(500).send("There was a problem retrieving the tweets.");
	   tweets.some(function(tweet) {
			let mediaType = "text";
			let timeStamp = Math.round(new Date(tweet.created_at))/1000;
			if(timeStamp < tsPastDate){
				return true;} //break out if tweets are older than 24h
			let media = tweet.entities;
			if(media.hashtags){
				var tags = "";
				for(var key in media.hashtags) {
					tags+=(media.hashtags[key]["text"] + " ");
				}
			}
			if(media.media){
				let extractedMedia = media.media[0].media_url;
				if(extractedMedia.includes("video_thumb")){
					mediaType = "video";
				}
				else{
					mediaType = "image";
				}
			}		
			let stats = new tweetModel({
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
			console.log(tweet.created_at);
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

// POSTS ALL TRACKED USERS' META INFO TO MONGO DB
router.put('/posts/trackedusers/', function (req, res) {
	//initialize variables
	var resultSet = [];
	let ts = Math.round(new Date().getTime() / 1000);
	let tsYesterday = ts - (24 * 3600);
	let loggedIn = false;
	//get credentials first
	const adminName = process.env.ADMIN_NAME;
	const adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW){
		loggedIn = true;
	}
	if(loggedIn == true){
		//BEGIN LOGIC:
		fs.readFile('usernames.txt', function(err, data) {
			if(err) throw err;
			let array = data.toString().split(/\r?\n/);
			for(i in array) {
				let username = array[i];
				console.log(username);
				//fill the result set with each
				client.get('statuses/user_timeline', {screen_name: username, count: 200}, function(error, tweets, response) {
					if (err) console.log("There was a problem retrieving the tweets.");
					tweets.some(function(tweet) {
							let timeStamp = Math.round(new Date(tweet.created_at))/1000;
							let mediaType = "text";
							if(timeStamp < tsYesterday){return true;}
							let media = tweet.entities;
							if(media.hashtags){
								var tags = "";
								for(var key in media.hashtags) {
									tags+=(media.hashtags[key]["text"] + " ");
								}
							}
							if(media.media){
								let extractedMedia = media.media[0].media_url;
								if(extractedMedia.includes("video_thumb")){
									mediaType = "video";
								}
								else{
									mediaType = "image";
								}
							}
							let stats = new tweetModel({
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
					console.log(username + " saved to db.");
				});
				//END CLIENT GET	
			} //END LOOP
			if (err) return res.status(500).send("There was a problem retrieving the tweets.");
			res.status(200).send();
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
	let loggedIn = false;
	const adminName = process.env.ADMIN_NAME;
	const adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW){
		loggedIn = true;
	}
	if(loggedIn == true){
		//get all entries matching username parameter
		let data = tweetModel.find({"userName" : req.params.username}).exec(function(err, users){
			if(err) return res.status(500).send(err);
			return res.status(200).send(users);
		});
	}
	else{
			return res.status(500).send("Unauthorized Access");
	}
});
//add username to list to scheduled search
router.post('/data/list/:username', function (req, res) {
	let loggedIn = false;
	const adminName = process.env.ADMIN_NAME;
	const adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW){
		loggedIn = true;
	}
	if(loggedIn == true){
		//adds username to list of usernames to search in the automated PUT function
		fs.appendFile('usernames.txt', (req.params.username+'\n'), (err) => {
		console.log(err);	
		});
	}
	else{
		return res.status(500).send("Unauthorized Access");
	}
	res.status(200).send();
});

//remove username's entries from MONGODB
router.delete('/data/user/:username', function (req, res) {
	let loggedIn = false;
	const adminName = process.env.ADMIN_NAME;
	const adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW){
		loggedIn = true;
	}
	if(loggedIn == true){
		tweetModel.find({ userName: req.params.username }, (err, user) => { 
			if (err) throw err;
					// delete this person's entries
					user.remove(function(err) {
						if (err) throw err;				
						console.log('User successfully deleted!');
					});
		});
	}
	else {
		return res.status(500).send("Unauthorized Access");
	}
	res.status(200).send();
});

//add username with associated tags to the db
router.post('/data/tags/:username', function (req, res) {
	let loggedIn = false;
	const adminName = process.env.ADMIN_NAME;
	const adminPW = process.env.ADMIN_PW;
	if(req.get('login_name') === adminName && req.get('password') === adminPW){
		loggedIn = true;
	}
	if(loggedIn == true){
		let userNames;
		fs.readFile('usernames.txt', function(err, data) {
			if(err) throw err;
			userNames = data.toString().split(/\r?\n/);
		});
		if(arr.indexOf(req.params.username) != -1){
		//adds username to list of usernames to search in the automated PUT function
		let userTags = new userTagsModel({
			userName: req.params.username,
			tags: req.get('tags_array')	
		});		
		userTags.save();
		}
		else{
			return res.status(500).send("Username isn't on the serverside tracking list.");
		}

	}
	else{
		return res.status(500).send("Unauthorized Access");
	}
	res.status(200).send();
});

module.exports = router;