var express = require('express');
var app = express();
var morgan = require('morgan');
const rateLimit = require("express-rate-limit");
 
app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
 
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

var UserController = require('./controllers/TwitStatsController');
app.use('/TwitReactionLog', UserController);

//  apply to all requests
app.use(morgan('combined')); //logger for api, standard apache format
app.use(limiter);

let port = 8210;
app.listen(port);
console.log("Listening on port " + port);

module.exports = app;