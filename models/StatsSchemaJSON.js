const schema = require('./node_modules/schm')

const statsSchema = schema({
  userName: String,
  retweets: Number,
  quotes: Number,
  favorites: Number,
  followers: Number,
  hashtags: String,
  date: String
});

module.exports = statsSchema;