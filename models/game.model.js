const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const gameSchema = new Schema({
	chat_id: { type: String, required: true},
	chat_title: {type: String, required: true},
	game_status: {type: Number, required: true}, //3 = closed, 1 = waiting for people, 2 = ongoing
	user_list: [{
		user_id: String,
		user_name: String,
		user_hand: [{
			number: Number,
			suit: String
		}],
		last_played: [{
			number: Number,
			suit: String
		}]
	}],
	current_user: Number,
	current_set: {
		settype: String,
		number: Number,
		suit: String,
		s3t: [{
			number: Number,
			suit: String
		}]
	},
	options: {
		timer: Number,
		autopass: String
	},
	turns_played: Number,
	times_passed: Number,
	winning_user: Number
}, {
	timestamps: true
});

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;