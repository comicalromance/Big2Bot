const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
	user_id: { type: String, required: true},
	total_wins: {type: Number},
	menu: [{
		chat_id: String,
		chat_title: String,
		message_id: String,
		options: [{
			settype: String,
			action: String,
			number: Number,
			suit: String,
			s3t: [{
				number: Number,
				suit: String
			}]
		}]
	}]
}, {
	timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;