var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const responseSchema = new Schema({
  userName: String,
  retweets: Number,
  replies: Number,
  quotes: Number,
  favorites: Number,
  followers: Number,
  hashtags: String,
  media: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("responseData", responseSchema);