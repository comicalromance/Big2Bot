const Telegraf = require("telegraf");
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')

let User = require('./models/user.model');
let Game = require('./models/game.model');
let Eng = require('./game');
let bot = require('./bot');

function compactKeyboard(options, set = false) {
	return_keyboard = [], keyboard = options.slice(0), temp = [];
	console.log(options);
	while(keyboard[keyboard.length-1].txt == 'Pass' || keyboard[keyboard.length-1].txt == '<<') temp.push(keyboard.pop());
    while(keyboard.length) {
        if(set) return_keyboard.push(keyboard.splice(0, 2));
        else return_keyboard.push(keyboard.splice(0, 4));
	}
	return_keyboard.push(temp);
    return return_keyboard;
}

function formatKeyboard(options, type='no') {
	let keyboard = [], return_keyboard = [], set = false;
	let results = Eng.generateKeyboard(options, type);
	for(let items of results) {
		if(items.settype != 'single' && items.settype != 'pair') set = true;
		if(!items.action) keyboard.push(Markup.callbackButton(Eng.convertToString(items.s3t), `cool=play ${items._id}`))
		else keyboard.push(Markup.callbackButton(items.txt, `cool=${items.action}`))
	}
	return_keyboard = compactKeyboard(keyboard, set);
	return return_keyboard;
}

function updateOptions(chat_title, chat_id, user_id, options) {
	return User.findOne({user_id: user_id}) 
		.then(user => {
			if(!user) throw "No user found to update cards!";
			if(!user.menu) user.menu = [];
			else {
				user.menu = user.menu.filter(menu => menu.chat_id != chat_id);
			}
			user.menu.push({chat_id: chat_id, chat_title: chat_title, message_id: "-1", options: options });
			return user.save();
		})
		.catch((err) => {return err});
}

function messageStatus(chat_id, user_id, user_name, players = []) {
    if(players.length) {
        let text = `<b>Players:</b> <pre>\n</pre><pre>\n</pre>`;
        for(let user of players) {
			text += `<a href="tg://user?id=${user.user_id}">${user.user_name}</a> (${user.user_hand.length} cards left): `;
			//console.log(user.last_played);
            if(user.last_played && user.last_played.length && user.last_played[0].suit == 'passed') text += `<b>Passed</b><pre>\n</pre>`;
            else text += `${Eng.convertToString(user.last_played)}<pre>\n</pre>`;
        }
        text += `<pre>\n</pre> <i>Waiting for <a href="tg://user?id=${user_id}">${user_name}</a> to play</i>`;
		bot.telegram.sendMessage(chat_id, text, {parse_mode: 'HTML'});
		
    }
    else {
        Game.findOne({chat_id: chat_id, game_status: 2})
            .then(game => {
				if(!game) {
					bot.telegram.sendMessage(chat_id, "No game in progress!")
					throw "No game in progress";
				}
                players = game.user_list;
                let text = `<b>Players:</b> <pre>\n</pre><pre>\n</pre>`;
                let uid = game.current_user, uname;
                for(let user of players) {
                    if(!user_name && user.user_id == uid) uname = user.user_name; 
					text += `<a href="tg://user?id=${user.user_id}">${user.user_name}</a>: `;
                    if(user.last_played[0].suit == 'passed') text += `<b>Passed</b><pre>\n</pre>`;
                    else text += `${Eng.convertToString(user.last_played)}<pre>\n</pre>`;
                }
                text += `<pre>\n</pre> <i>Waiting for <a href="tg://user?id=${uid}">${uname}</a> to play</i>`;
                bot.telegram.sendMessage(chat_id, text, {parse_mode: 'HTML'});
            })
            .catch(err => console.log(err));
    }
}

function generateOptions(chat_id, user_id, hand = [], current_set = {}) {
	if(hand.length) {
		if(current_set.settype) options = Eng.generateOptions(hand, current_set);
		else options = Eng.generateAllOptions(hand);
		return new Promise(function(resolve, reject) { resolve(options)});
	}
	else {
		return Game.findOne({chat_id: chat_id, game_status: 2})
			.then(game => {
				for(let user of game.user_list) {
					if(user.user_id == user_id) {
						return Eng.generateAllOptions(user.user_hand);
					}
				}
			})
			.catch(err => console.log(err));
	}
}

function startTurn(chat_title, chat_id, user_id, user_name, hand = [], players = [], set = {}) {
	messageStatus(chat_id, user_id, user_name, players);
	//let genO = new Promise(function(resolve, reject) {
	//	return generateOptions(chat_id, user_id, hand, set);
	//})
	let gen0 = generateOptions(chat_id, user_id, hand, set);
	let _msg;
	gen0.then(options => {
			return updateOptions(chat_title, chat_id, user_id, options);
		})
	.then((hi) => { 
			return User.findOne({user_id: user_id}, {menu: { $elemMatch: {chat_id: chat_id} } }) 
		})
		.then(user => {
			let options = user.menu[0].options;
			if(user_id.indexOf('bot') != -1) {
				return playRandom(chat_id, chat_title, user_id, user_name, options)
					.then(() => {throw "bot plays"})
			}
			if(!set.settype) {
				keyboard = formatKeyboard(options, 'start');
				return bot.telegram.sendMessage(user_id, "Pick an option!", {reply_markup: Markup.inlineKeyboard(keyboard, {selective: true}), parse_mode: 'HTML'})
			}
			else {
				keyboard = formatKeyboard(options); 
				return bot.telegram.sendMessage(user_id, "Pick an option!", {reply_markup: Markup.inlineKeyboard(keyboard, {selective: true}), parse_mode: 'HTML'})
			}
		})
		.then(msg => {
			_msg = msg;
			return User.findOne({user_id: user_id}, {menu: { $elemMatch: {chat_id: chat_id} } })
		})
		.then(user => {
			user.menu[0].message_id = _msg.message_id;
			return user.save();
		})
        .catch(err => {
			console.log(err)
		});
}

function playRandom(chat_id, chat_title, user_id, user_name, options, pass = false) {
	//let randIndex = Math.floor(Math.random() * (options.length + 1));
	//if(randIndex == options.length) {
		//return playOption(chat_id, chat_title, user_id, user_name, "", true)
	//}
	//else {
	//	return playOption(chat_id, chat_title, user_id, user_name, options[randIndex]);
	//}
	if(options.length == 0) return playOption(chat_id, chat_title, user_id, user_name, "", true);
	else return playOption(chat_id, chat_title, user_id, user_name, options[0]);
}

function playOption(chat_id, chat_title, user_id, user_name, options = [], pass = false) {
	let next_user, next_username, next_index, next_hand, players, current_set;
	return Game.findOne({chat_id: chat_id, game_status: 2})
		.then(game => {
			if(game.user_list[game.current_user].user_id != user_id) {
				bot.telegram.sendMessage(user_id, "Not your turn!");
				throw "not your turn!";
			}
			if(!pass) {
                game.current_set = options;
                game.user_list[game.current_user].last_played = options.s3t;
                game.winning_user = game.current_user;
				game.times_passed = 0;
				for(let user of game.user_list) {
					if(user.user_id == user_id) {
                        user.user_hand = Eng.removeCards(user.user_hand, options.s3t);
                        if(user.user_hand.length == 0) {
                            game.game_status = 3;
                            bot.telegram.sendMessage(chat_id, `<b>Player <a href="tg://user?id=${user_id}">${user_name}</a> has won!</b>`, {parse_mode: 'HTML'})
                            return game.save();
                        }
					}
				}
			}
			else {
                game.times_passed++;
                game.user_list[game.current_user].last_played = [{suit: "passed"}];
            }

			game.current_user = (game.current_user + 1) % 4;

			if(game.times_passed == 3) {
				game.current_set = [];
				next_index = game.winning_user;
				next_user = game.user_list[next_index].user_id;
				next_username = game.user_list[next_index].user_name;
				next_hand = game.user_list[next_index].user_hand;
                game.times_passed = 0;
                for(let user of game.user_list) {
                    user.last_played = [];
                }
				bot.telegram.sendMessage(chat_id,`Everyone has passed. <a href="tg://user?id=${next_user}">${next_username}</a> will start. `, {parse_mode: 'HTML'});
            }

			else {
				next_index = game.current_user;
				next_user = game.user_list[next_index].user_id;
				next_username = game.user_list[next_index].user_name;
				next_hand = game.user_list[next_index].user_hand;
				if(!pass) bot.telegram.sendMessage(chat_id,`<a href="tg://user?id=${user_id}">${user_name}</a> has played ${Eng.convertToString(options.s3t)}`, {parse_mode: 'HTML'});
				else bot.telegram.sendMessage(chat_id,`<a href="tg://user?id=${user_id}">${user_name}</a> has passed.`, {parse_mode: 'HTML'});
			}
			current_set = game.current_set;
			players = game.user_list;
			
			return game.save();
		})
		.then(() => {
			startTurn(chat_title, chat_id, next_user, next_username, next_hand, players, current_set);
		})
		.catch(err => console.log(err));
}

module.exports = {playOption, startTurn, generateOptions, updateOptions, formatKeyboard, messageStatus}