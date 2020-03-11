const Telegraf = require("telegraf");
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const Express = require("express")

const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

let User = require('./models/user.model');
let Game = require('./models/game.model');
let Eng = require('./game');

const db_uri = process.env.ATLAS_URI;
mongoose.connect(db_uri, {useNewUrlParser: true, useCreateIndex: true });

const connection = mongoose.connection;
connection.once('open', () => {
	console.log("MongoDB connection established");
});

const app = Express();
app.set('port', (process.env.PORT || 5000));

//For avoidong Heroku $PORT error
app.get('/', function(request, response) {
    var result = 'App is running'
    response.send(result);
}).listen(app.get('port'), function() {
    console.log('App is running, server is listening on port ', app.get('port'));
});

bot.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log('Response time: %sms', ms)
  console.log(ctx.message)
})

function listPlayers(chat_id) {
	let msg = "Current Players:<pre>\n</pre>";
	Game.findOne({chat_id: chat_id, game_status: {$ne: 4}})
		.then(game => {
			if(game == null) {
				ctx.reply("No game detected");
				throw("No game detected");
			}
			for(const i of game.user_list) {
				msg += `<a href="tg://user?id=${i.user_id}">${i.user_name}</a><pre>\n</pre>`;
				console.log(i["user_name"])
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

function startGame(chat_id) {
	let currentPlayer, hands = Eng.generateHands(4);
	Game.findOne({chat_id: chat_id, game_status: 2})
		.then(game => {
			if(!game) {
				bot.telegram.sendMessage(chat_id, "ERROR: Game not found");
				throw("Game not found");
			}
			for(let i=0; i<game.user_list.length; i++) {
				game.user_list[i].user_hand = Eng.sortHand(hands[i]);
				if(!game.current_user && Eng.find3Dim(hands[i])) {
					game.current_user = i;
					currentPlayer = {"user_id": game.user_list[i].user_id, "user_name": game.user_list[i].user_name}
				}
			}
			game.save();
		})
		.then(() => {
			bot.telegram.sendMessage(chat_id, `The starting player is <a href="tg://user?id=${currentPlayer.user_id}">${currentPlayer.user_name}</a>!`, {parse_mode: 'HTML'});
		})
		.catch(err => console.log(err));
}

bot.hears(/^\/start[ =](.+)$/, (ctx) => {
	let user_id = ctx.message.from.id;
	let user_name = ctx.message.from.first_name + " " + ctx.message.from.last_name;
	let chat_id = ctx.match[1];
	let chat_title = ctx.message.from.id;
	let total_wins = 0;
	let game_start = false;

	User.findOne({user_id: user_id})
		.then(users => {
			if(!users) {
				const newUser = new User({ 
					user_id, 
					chat_id, 
					chat_title,
					total_wins
				});
				return newUser.save();
			}
		})
		.then(() => {return Game.findOne({chat_id: chat_id, game_status: {$ne: 4} }) } )
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
				if(checkUserinList(games.user_list, user_id)) {
					ctx.reply(`Already in Game in ${chat_title}!`);
					throw("Already in Game!");
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
			}
		})
		.then(() => {
			ctx.replyWithHTML(`Joined game in <b>${chat_title}!</b>`);
			bot.telegram.sendMessage(chat_id, `<a href="tg://user?id=${user_id}">${user_name}</a> has joined the game!`, {parse_mode: 'HTML'});
			listPlayers(chat_id);
		})
		.then(() => {if(game_start) startGame(chat_id);})
		.catch(err => console.log(err));
});

bot.command('start' , (ctx) => {
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
					const newGame = new Game({
						chat_id,
						chat_title,
						game_status,
						user_list,
					});
					newGame.save()
						.then(() => {
							ctx.replyWithHTML('Join the game of <b>Big2</b> by pressing Start below!', Markup.inlineKeyboard([
								Markup.urlButton('Start', `https://t.me/SGBig2Bot?start=${chat_id}`)
							]).extra())
						})
						.catch(err => console.log(err))
				}
			})
			.catch(err => console.log(err))
	}
})

bot.command('stop', ctx => {
	if(ctx.message.chat.type == 'private') return;
	let chat_id = ctx.message.chat.id;
	let user_id = ctx.message.from.id;
	Game.findOne({chat_id: chat_id, "user_list.user_id": user_id, game_status: {$ne: 4 }})
		.then((game) => {
			if(game == null) throw "No game to be closed!";
			game.game_status = 4;
			return game.save();
		})
		.then(() => ctx.reply("Game has been stopped!"))
		.catch((err) => ctx.reply(err))
})

bot.command('listplayers', ctx => {
	if(ctx.message.chat.type == 'private') return;
	let chat_id = ctx.message.chat.id;
	listPlayers(chat_id, ctx);
})

bot.command('join', ctx => {
	//ctx.answerCbQuery('');
	if(ctx.message.chat.type == 'private') return;

	let chat_id = ctx.message.chat.id;
	let chat_title = ctx.message.chat.title;
	let user_id = ctx.message.from.id;
	let user_name = ctx.message.from.first_name + " " + ctx.message.from.last_name;
	let user_hand = [];
	let game_start = false;

	Game.findOne({chat_id: chat_id, game_status: 1})
		.then(games => {
			if(games == null) {
				ctx.reply("No ongoing game!");
				throw("No ongoing game");
			}
			else if(games.game_status != 1) {
				ctx.reply("Unable to join game!");
				throw("Unable to join game!");
			}
			else {
				if(checkUserinList(games.user_list, user_id)) {
					ctx.reply("Already in Game!");
					throw("Already in Game!");
				}
				else {
					ctx.replyWithHTML("Join the game of <b>Big2</b> by pressing Start below!", Markup.inlineKeyboard([
						Markup.urlButton('Start', `https://t.me/SGBig2Bot?start=${chat_id}`)
					]).extra());
				}
			}
		})
		.catch(err => console.log(err));
});

bot.command('whack', ctx => {
	if(ctx.message.chat.type == 'private') return;

	let chat_id = ctx.message.chat.id;
	let chat_title = ctx.message.chat.title;
	getPlayerList(chat_id)
		.then((options) => {
			if(options.length == 1) ctx.reply(options[0]);
			else {
				bot.telegram.sendPoll(chat_id, "Who to Whack?", JSON.stringify(options))
					.then(poll => {
						const npoll = {"poll_id": poll.poll.id, "message_id": poll.message_id};
						return Game.update({chat_id: chat_id, game_status: 2}, {poll: npoll})
					})
					.then(() => {
						console.log("Saved Poll Data");
					})
					.catch(err => console.log(err));
			}
		})
})

bot.on('poll', ctx =>  {
	let chat_id = 0, winner, max = 0, totalWhacked = 0, updates = [];
	if(ctx.poll.total_voter_count == ctx.poll.options.length) {
		let options = ctx.poll.options;
		const whacked_name = findMostVoted(options);
		Game.findOne({"poll.poll_id": ctx.poll.id, game_status: 2})
			.then(game => {
				if(game == null) throw("No polling game");
				chat_id = game.chat_id;
			})
			.then(() => {
				bot.telegram.sendMessage(chat_id, `The whacked person is ${whacked_name}!`);
				return Game.update({chat_id: chat_id, game_status: 2}, {game_status: 3});
			})
			.then(() => {
				bot.telegram.sendMessage(chat_id, "Let the whacking begin!", Markup.inlineKeyboard([
					Markup.callbackButton('Whack!', 'whack')
				]).extra());
				return new Promise(resolve => {
					setTimeout(() => resolve("done!"), 10000);
				});
			})
			.then(() => {
				return Game.findOne({chat_id: chat_id, game_status: 3})
					.then(game => {
						game.game_status = 4;
						for(const i of game.user_list) {
							updates.push({"user_id": i["user_id"], "user_whacked": i["user_whacked"]});
							totalWhacked += i["user_whacked"];
							if(i["user_whacked"] > max) {
								max = i["user_whacked"];
								winner = i["user_name"];
							}
						}
						return game.save();
					}) 
			})
			.then(() => {
				bot.telegram.sendMessage(chat_id, "Time is up!");
				bot.telegram.sendMessage(chat_id, `Total whacks: ${totalWhacked}`);
				bot.telegram.sendMessage(chat_id, `Most whacks: ${winner} at ${max} whacks!`);
			})
			.then(() => {
				let bulkUpdate = User.collection.initializeUnorderedBulkOp();
				for(const i of updates) {
					bulkUpdate.find({user_id: i["user_id"]}).updateOne({$inc: {total_whacks: parseInt(i["user_whacked"])}});
				}
				return bulkUpdate.execute()
			})
			.then(() => console.log("executed!"))
			.catch(err => console.log(err));
	}
})

bot.command('viewstats', ctx => {
	let user_id = ctx.message.from.id;
	let user_name = ctx.message.from.first_name + " " + ctx.message.from.last_name;
	User.findOne({user_id: user_id})
		.then(user => {
			ctx.reply(`${user_name} has a total of ${user.total_wins} wins!`);
		})
		.catch(err => console.log(err));
})

bot.action('whack', ctx => {
	let user_id = ctx.update.callback_query.from.id;
	let chat_id = ctx.update.callback_query.message.chat.id;
	ctx.answerCbQuery('');
	Game.findOne({chat_id: chat_id, game_status: 3})
		.then(game => {
			if(!game) throw("This game is over!");
			let index = 0;
			for(const i of game.user_list) {
				if(i["user_id"] == user_id) {
					game.user_list[index].user_whacked++;
					break;
				}
				index++;
			}
			return game.save();
		})
		.then(() => {
			console.log("Whacked!");
		})
		.catch(err => console.log(err));
})

bot.launch()