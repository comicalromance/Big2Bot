const Telegraf = require("telegraf");
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');

let User = require('./models/user.model');
let Game = require('./models/game.model');
let Options = require('./options');
let Eng = require('./game');
let bot = require('./bot');
let Misc = require('./misc');

function startGame(chat_id, chat_title) {
	let currentPlayer, hands = Eng.generateHands(4);
	let players = [];
	Game.findOne({chat_id: chat_id, game_status: 2})
		.then(game => {
			if(!game) {
				bot.telegram.sendMessage(chat_id, "ERROR: Game not found");
				throw("Game not found");
			}
			for(let i=0; i<game.user_list.length; i++) {
				game.user_list[i].user_hand = Eng.sortHand(hands[i]);
				if(game.user_list[i].user_id.indexOf("bot") == -1) bot.telegram.sendMessage(game.user_list[i].user_id, Eng.convertHandToString(game.user_list[i].user_hand), {parse_mode: 'HTML'});
				if(!game.current_user && Eng.find3Dim(hands[i])) {
					game.current_user = i;
					currentPlayer = {"user_id": game.user_list[i].user_id, "user_name": game.user_list[i].user_name, "user_hand": game.user_list[i].user_hand, "options": game.options};
				}
				players = game.user_list;
			}
			return game.save();
		})
		.then(() => {
			Options.startTurn(chat_title, chat_id, currentPlayer.user_id, 
				currentPlayer.user_name, currentPlayer.user_hand, players, {}, currentPlayer.options);
			bot.telegram.sendMessage(chat_id, `The starting player is <a href="tg://user?id=${currentPlayer.user_id}">${currentPlayer.user_name}</a>!`, {parse_mode: 'HTML'});
		})
		.catch(err => console.log(err));
}

function handleStart(ctx) {
	let user_id = ctx.message.from.id;
	let user_list = [];

	if(ctx.message.chat.type == 'private') {
		let chat_id = ctx.message.from.id;
		let chat_title = ctx.message.from.id;
		let total_wins = 0;
		User.findOne({user_id: user_id})
			.then(users => {
				if (users) ctx.reply('hi!');
				else {
					const newUser = new User({ 
						user_id, 
						chat_id, 
						chat_title,
						total_wins
					});
					newUser.save();
				}	
			})
			.catch(err => console.log(err));
	}

	else {
		let chat_id = ctx.message.chat.id;
		let chat_title = ctx.message.chat.title;
		Game.findOne({chat_id: chat_id, game_status: 1})
			.then(games => {
				if(games) {
					ctx.reply(`Game in ${chat_title} already started!`, Markup.inlineKeyboard([
						Markup.urlButton('Start', `https://t.me/SGBig2Bot?start=${chat_id}`)
					]).extra());
				}
				else {
					let game_status = 1;
					let options = {
						timer: 0,
						autopass: 'Disabled'
					}
					const newGame = new Game({
						chat_id,
						chat_title,
						game_status,
						user_list,
						options: options,
						turns_played: 0,
					});
					newGame.save()
						.then(() => {
							ctx.replyWithHTML('Join the game of <b>Big2</b> by pressing Start below! Set game options by typing /options!', Markup.inlineKeyboard([
								Markup.urlButton('Start', `https://t.me/SGBig2Bot?start=${chat_id}`)
							]).extra())
						})
						.catch(err => console.log(err))
				}
			})
			.catch(err => console.log(err))
	}
}

function addBot(ctx) {
	let user_id = 'bot' + Math.floor(Math.random()*100000);
	let user_name = user_id;
	let chat_id = ctx.message.chat.id;
	let chat_title;
	let total_wins = 0;
	let game_start = false;

	const newUser = new User({
		user_id,
		total_wins
	})
	newUser.save()
	Game.findOne({chat_id: chat_id, game_status: {$ne: 3} })
		.then(games => {
			if(games == null) {
				ctx.reply("No ongoing game!");
				throw("No ongoing game");
			}
			chat_title = games.chat_title;
			if(games.game_status != 1) {
				ctx.reply(`Unable to add bot in ${chat_title}!`);
				throw("Unable to add bot!");
			}
			else {
				let user_hand = [];
				const list = {"user_id": user_id, "user_name": user_name, "user_hand": user_hand};
				games.user_list.push(list);
				if(games.user_list.length == 4) {
					games.game_status = 2;
					game_start = true;
				}
				return games.save();
			}
		})
		.then(() => {
			bot.telegram.sendMessage(chat_id, `${user_name} has joined the game!`, {parse_mode: 'HTML'});
			Misc.listPlayers(chat_id);
		})
		.then(() => {if(game_start) startGame(chat_id, chat_title);})
		.catch(err => console.log(err));
}

function startOptions(ctx) {
	if(ctx.message.chat.type != 'private') {
		ctx.reply(`Do you want to turn on Turn Timer? (Player will automatically pass after 2 minutes of inactivity)`, Markup.inlineKeyboard([
			Markup.callbackButton('Yes', `options=turn:T`), Markup.callbackButton('No', `options=turn:F`)
		]).extra());
	}
}

function hearOptions(ctx) {
	ctx.answerCbQuery('');
	let chat_id = ctx.update.callback_query.message.chat.id;
	let option = ctx.match[1];
	console.log(chat_id);
	if(option.indexOf('turn') != -1) {
		let choice = option.split(':')[1];
		if(choice == 'T') {
			Game.updateOne({chat_id: chat_id, game_status: 1}, {$set: {'options.timer': 120}}, function(err, doc) {});
			ctx.replyWithHTML('Turn Timer of <b>2 Minutes</b> Activated!');
		}
		else if(choice == 'F') {
			Game.updateOne({chat_id: chat_id, game_status: 1}, {$set: {'options.timer': 0}}, function(err, doc) {});
			ctx.replyWithHTML('Turn Timer <b>Disabled</b>!');
		}
		else {
			ctx.reply('Invalid Choice!');
			return;
		}
		ctx.editMessageReplyMarkup({inline_keyboard: [[]]});

		ctx.reply(`Do you want to turn on Auto Pass? (Player will automatically pass if they have no higher card)`, Markup.inlineKeyboard([
			Markup.callbackButton('Yes', `/options=autopass:T`), Markup.callbackButton('No', `/options=autopass:F`)
		]).extra());
	}

	else if(option.indexOf('autopass') != -1) {
		let choice = option.split(':')[1];
		if(choice == 'T') {
			Game.updateOne({chat_id: chat_id, game_status: 1}, {$set: {'options.autopass': 'Strict'}}, function(err, doc) {});
			ctx.replyWithHTML('Autopass <b>Enabled!</b>');
		}
		else if(choice == 'F') {
			Game.updateOne({chat_id: chat_id, game_status: 1}, {$set: {'options.autopass': 'Disabled'}}, function(err, doc) {});
			ctx.replyWithHTML('Autopass <b>Disabled!</b>');
		}
		else {
			ctx.reply('Invalid Choice!');
			return;
		}
		ctx.editMessageReplyMarkup({inline_keyboard: [[]]});
	}
}

function hearStart(ctx) {
    let user_id = ctx.message.from.id;
	let user_name = ctx.message.from.first_name + " " + ctx.message.from.last_name;
	let chat_id = ctx.match[1];
	let chat_title;
	let total_wins = 0;
	let game_start = false;

	User.findOne({user_id: user_id})
		.then(users => {
			if(!users) {
				const newUser = new User({ 
					user_id, 
					total_wins
				});
				return newUser.save();
			}
		})
		.then(() => {return Game.findOne({chat_id: chat_id, game_status: {$ne: 3} }) } )
		.then(games => {
			if(games == null) {
				ctx.reply("No ongoing game!");
				throw("No ongoing game");
			}
			chat_title = games.chat_title;
			if(games.game_status != 1) {
				ctx.reply(`Unable to join game in ${chat_title}!`);
				throw("Unable to join game!");
			}
			else {
				if(Misc.checkUserinList(games.user_list, user_id)) {
					ctx.reply(`Already in Game in ${chat_title}!`);
					throw("Already in Game!");
				}
				else {
					let user_hand = [];
					const list = {"user_id": user_id, "user_name": user_name, "user_hand": user_hand};
					games.user_list.push(list);
					console.log(games.user_list);
					if(games.user_list.length == 4) {
						games.game_status = 2;
						game_start = true;
					}
					return games.save();
				}
			}
		})
		.then(() => {
			ctx.replyWithHTML(`Joined game in <b>${chat_title}!</b>`);
			bot.telegram.sendMessage(chat_id, `<a href="tg://user?id=${user_id}">${user_name}</a> has joined the game!`, {parse_mode: 'HTML'});
			Misc.listPlayers(chat_id);
		})
		.then(() => {if(game_start) startGame(chat_id, chat_title);})
		.catch(err => console.log(err));
}

module.exports = {startGame, handleStart, hearStart, addBot, hearOptions, startOptions}
