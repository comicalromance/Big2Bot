const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
	user_id: { type: String, required: true},
	chat_id: { type: String, required: true},
	chat_title: {type: String, required: true},
	total_wins: {type: Number}
}, {
	timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;