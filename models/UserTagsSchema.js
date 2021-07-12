var mongoose = require('mongoose');

var userTagsSchema = new mongoose.Schema({
    userName: String,
    tags: [{
        type: String
    }]
});

module.exports = mongoose.model("tagData", userTagsSchema);