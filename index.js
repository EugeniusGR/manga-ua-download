const TelegramBot = require('node-telegram-bot-api');
const { getMessage, setCommands } = require('./bot/bot_helpers');
require('dotenv').config();

const bot = new TelegramBot(process.env.API_KEY_BOT, {
  polling: {
    interval: 300,
    autoStart: true,
  },
  filepath: true,
});

setCommands(bot);

bot.on('polling_error', (err) => console.log(err));

bot.on('text', (msg) => getMessage(msg, bot));
