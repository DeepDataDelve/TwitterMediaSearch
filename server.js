var express = require('express');
var app = express();
var log4js = require("log4js");
var morgan = require("morgan");
var fs = require("fs");
log4js.configure({ // configure to use all types in different files.
  appenders: {
    out: { type: 'stdout' },
    app: { type: 'file', filename: 'logs/application.log' }
  },
  categories: {
    default: { appenders: [ 'out', 'app' ], level: 'debug' }
  }
});

var accessLogStream = fs.createWriteStream(('logs/access.log'), { flags: 'a' });
var HTTPLog = morgan(
  'combined',
  {
    "stream": accessLogStream//{ write: function(str) { theAppLog.all(str); } }
  }
);
app.use(HTTPLog);
const rateLimit = require("express-rate-limit");
app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
 
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

var UserController = require('./controllers/TwitStatsController');
app.use('/TwitReactionLog', UserController);
//  apply to all requests
//app.use(morgan('combined')); //logger for api, standard apache format
app.use(limiter);

let port = 8210;
app.listen(port);
console.log("Listening on port " + port);

module.exports = app;