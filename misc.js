let User = require('./models/user.model');
let Game = require('./models/game.model');
let bot = require('./bot');

function listPlayers(chat_id) {
	let msg = "Current Players:<pre>\n</pre>";
	Game.findOne({chat_id: chat_id, game_status: {$ne: 4}})
		.then(game => {
			if(game == null) {
				bot.telegram.sendMessage(chat_id, "No game detected");
				throw("No game detected");
			}
			for(const i of game.user_list) {
				msg += `<a href="tg://user?id=${i.user_id}">${i.user_name}</a><pre>\n</pre>`;
				console.log(i["user_name"]);
            }
			bot.telegram.sendMessage(chat_id, msg, {parse_mode: 'HTML'});
		})
		.catch(err => msg = err)
}

function getPlayerList(chat_id) {
	let arr = [];
	return Game.findOne({chat_id: chat_id, game_status: {$ne: 4}})
		.then(game => {
			if(game == null) {
				return ["No current game detected!"];
			}
			else if (game.game_status != 1) {
				return ["Game is polling/ongoing!"];
			}
			for(const i of game.user_list) {
				arr.push(i["user_name"]);
			}
			if(arr.length > 1) {
				game.game_status = 2;
				return game.save()
					.then(() => {
						console.log("Updated Status");
						return arr;
					})
					.catch(err => {return ["Failed to save game"]});
			}
			else return ["Not enough players"];
		})
		.catch(err => {return ["Failed to start game"]})
}

function checkUserinList(list, user_id) {
	for(const i of list) {
		if(i["user_id"] == user_id) return true;
	}
	return false;
}

function findMostVoted(options) {
	let max = 0, maxUser;
	for(const i of options) {
		if(i["voter_count"] > max) {
			max = i["voter_count"];
			maxUser = i["text"];
		}
	}
	return maxUser;
}

module.exports = {listPlayers, getPlayerList, checkUserinList, findMostVoted}