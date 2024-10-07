const TelegramBot = require('node-telegram-bot-api');
const { getMessage, setCommands } = require('./bot/bot_helpers');

const url = 'https://manga.in.ua/chapters/3982-dandadan-tom-1-rozdil-1.html';

const bot = new TelegramBot(process.env.API_KEY_BOT, {
  polling: {
    interval: 300,
    autoStart: true,
  },
  filepath: true,
});

setCommands(bot);

bot.on('polling_error', (err) => console.log(err.data.error.message));

bot.on('text', (msg) => getMessage(msg, bot));
