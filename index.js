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
let Options = require('./options');
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

bot.command('viewhand', ctx => {
	let chat_id = ctx.message.chat.id;
	let user_id = ctx.message.user.id;
	Misc.viewHand(chat_id, user_id);
})

bot.command('stop', ctx => {
	if(ctx.message.chat.type == 'private') return;
	let chat_id = ctx.message.chat.id;
	let user_id = ctx.message.from.id;
	Game.findOne({chat_id: chat_id, "user_list.user_id": user_id, game_status: {$ne: 4 }})
		.then((game) => {
			if(game == null) throw "No game to be closed!";
			game.game_status = 3;
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

bot.command('addbot', ctx => {
	Start.addBot(ctx);
})

bot.command('testreply', ctx => {
	let keyboard = [], current_set, usr;
	let user_id = ctx.message.from.id;
	let chat_title = ctx.message.chat.title;
	let chat_id = ctx.message.chat.id;
	let user_name = ctx.message.from.first_name + " " + ctx.message.from.last_name;
	Options.startTurn(chat_title, chat_id, user_id, user_name);
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

bot.command('status', ctx => {
	Options.messageStatus(ctx.message.chat.id);
})

bot.command('forcestart', ctx => {
	Start.startGame(ctx.message.chat.id, ctx.message.chat.title);
})

bot.action(/^cool=(.+)$/, ctx => {
	ctx.answerCbQuery('');
	let message_id = ctx.update.callback_query.message.message_id;
	let user_id = ctx.update.callback_query.from.id;
	let user_name = ctx.update.callback_query.from.first_name + " " + ctx.update.callback_query.from.last_name;
	let action = ctx.match[1];
	User.findOne({user_id: user_id}, {menu: { $elemMatch: {message_id: message_id} } })
		.then(user => {
			if(!user) throw("Message not found: Outdated Query?");
			if(action.split(" ")[0] == "play") {
				let index = action.split(" ")[1];
				for(let option of user.menu[0].options) {
					if(index == option._id) {
						ctx.editMessageReplyMarkup({inline_keyboard: [[]]});
						return Options.playOption(user.menu[0].chat_id, user.menu[0].chat_title, user_id, user_name, option);
					}
				}
				throw("Couldn't find option");
			}
			else if(action == "pass") {
				ctx.editMessageReplyMarkup({inline_keyboard: [[]]});
				return Options.playOption(user.menu[0].chat_id, user.menu[0].chat_title, user_id, user_name, "", true);
			}
			else {
				let keyboard = Options.formatKeyboard(user.menu[0].options, action)
				return ctx.editMessageReplyMarkup({inline_keyboard: keyboard } )
			}
		})
		.catch(err => console.log(err));
})

bot.launch()