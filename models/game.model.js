const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const gameSchema = new Schema({
	chat_id: { type: String, required: true},
	chat_title: {type: String, required: true},
	game_status: {type: Number, required: true}, //0 = closed, 1 = waiting for people, 2 = ongoing
	user_list: [{
		user_id: String,
		user_name: String,
		user_hand: [{
			number: Number,
			suit: String
		}]
	}],
	current_user: String
}, {
	timestamps: true
});

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;