var mongoose = require('mongoose');

var userTagsSchema = new mongoose.Schema({
    userName: String,
    tags: [{
        type: String
    }]
}, {
    versionKey: false
});

module.exports = mongoose.model("tagData", userTagsSchema);