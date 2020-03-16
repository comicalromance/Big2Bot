const Telegraf = require("telegraf");
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const Express = require("express")

const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

let User = require('./models/user.model');
let Game = require('./models/game.model');
let Eng = require('./game');
let Start = require('./start');
let Misc = require('./misc');
let bot = require('./bot');

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

bot.hears(/^\/start[ =](.+)$/, ctx => Start.hearStart(ctx));

bot.command('start', ctx => Start.handleStart(ctx));

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
	Misc.listPlayers(chat_id);
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
				if(Misc.checkUserinList(games.user_list, user_id)) {
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
	Misc.getPlayerList(chat_id)
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

function formatKeyboard(options, type) {
	keyboard = [];
	if(type == "start") {
		options = Eng.generateStartingKeyboard(options);
	}
	for(let items of options) {
		if(!items.action) keyboard.push(Markup.callbackButton(Eng.convertToString(items.s3t), `cool=${items._id}`))
		else keyboard.push(Markup.callbackButton(items.text, `cool=${items.action}`))
	}
	return keyboard;
}

function generateOptions(chat_title, chat_id, user_id) {
	let options = [], current_set;
	return Game.findOne({chat_id: chat_id, game_status: 2})
		.then(game => {
			for(let user of game.user_list) {
				if(user.user_id == user_id) {
					if(game.current_set.length) { // confus
						current_set = game.current_set;
						options = Eng.generateOptions(user.user_hand, current_set);
					}
					else options = Eng.generateAllOptions(user.user_hand);
					break;
				}
			}
			return User.findOne({user_id: user_id}) 
		})
		.then(user => {
			if(!user.menu) user.menu = [];
			else {
				user.menu = user.menu.filter(menu => menu.chat_id != chat_id);
			}
			user.menu.push({chat_id: chat_id, chat_title: chat_title, message_id: "-1", options: options });
			return user.save();
		})
		.then(() => {return current_set})
		.catch((err) => {return err});
}

bot.command('testreply', ctx => {
	let keyboard = [], current_set, usr;
	let user_id = ctx.message.from.id;
	let chat_title = ctx.message.chat.title;
	let chat_id = ctx.message.chat.id;
	generateOptions(chat_title, chat_id, user_id)
		.then(current => {
			current_set = current;
			return User.findOne({user_id: user_id}, {menu: { $elemMatch: {chat_id: chat_id} } })
		})
		.then(user => {
			let options = user.menu[0].options; usr = user;
			if(!current_set) {
				keyboard = formatKeyboard(options, 'start');
				console.log(keyboard);
				return bot.telegram.sendMessage(user_id,`<a href="tg://user?id=${ctx.message.from.id}">${ctx.message.from.first_name}</a>`, {reply_markup: Markup.inlineKeyboard(keyboard, {selective: true}), parse_mode: 'HTML'})
			}
			else {
				keyboard = formatKeyboard(options);
				return bot.telegram.sendMessage(user_id, `<a href="tg://user?id=${ctx.message.from.id}">${ctx.message.from.first_name}</a>`, {reply_markup: Markup.inlineKeyboard(keyboard, {selective: true}), parse_mode: 'HTML'})
			}
		})
		.then(msg => {
			usr.menu[0].message_id = msg.message_id;
			usr.save();
		})
		/*.then(() => {
			ctx.replyWithHTML(`<a href="tg://user?id=${ctx.message.from.id}">${ctx.message.from.first_name}</a>`, Markup.inlineKeyboard(keyboard, {selective: true}).extra())
		})*/
})

bot.on('poll', ctx =>  {
	let chat_id = 0, winner, max = 0, totalWhacked = 0, updates = [];
	if(ctx.poll.total_voter_count == ctx.poll.options.length) {
		let options = ctx.poll.options;
		const whacked_name = Misc.findMostVoted(options);
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

bot.action(/^cool=(.+)$/, ctx => {
	ctx.answerCbQuery('');
	let message_id = ctx.update.callback_query.message.message_id;
	let user_id = ctx.update.callback_query.from.id;
	let action = ctx.match[1];
	//User.findOne({user_id: user_id, })
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