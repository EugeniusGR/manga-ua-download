// import json with commands
const { startParsing, startParsingSelected } = require('../browser_helpers');
const commands = require('./commands.json');
const fs = require('fs');

const getMessage = async (msg, bot) => {
  switch (true) {
    case msg.text.includes('/start'):
      handleStart(msg, bot);
      break;
    case msg.text.includes('/help'):
      handleStart(msg, bot);
      break;
    case msg.text.includes('/parse_selected'):
      handleStartSelected(msg, bot);
      break;
    case msg.text.includes('/parse'):
      // get url from parse
      const url = msg.text.split(' ')[1];
      if (url) {
        await bot.sendMessage(msg.chat.id, `Починаю парсинг ${url}...`);
        startParsing(
          url,
          () => showProgress(bot, msg.chat.id),
          (filePath) => sendFile(bot, msg.chat.id, filePath),
          (message) => sendError(bot, msg.chat.id, message)
        );
      } else {
        sendError(bot, msg.chat.id, 'Помилка: некоректне посилання!');
      }
      break;
  }
};

const setCommands = async (bot) => {
  await bot.setMyCommands(commands);
};

const handleStartSelected = async (msg, bot) => {
  const fromChapter = msg.text.split(' ')[2];
  const toChapter = msg.text.split(' ')[3];
  const url = msg.text.split(' ')[1];
  console.log('fromChapter:', fromChapter);
  console.log('toChapter:', toChapter);
  if (url) {
    await bot.sendMessage(msg.chat.id, `Починаю парсинг ${url}...`);
    startParsingSelected(
      url,
      fromChapter,
      toChapter,
      () => showProgress(bot, msg.chat.id),
      (filePath) => sendFile(bot, msg.chat.id, filePath),
      (message) => sendError(bot, msg.chat.id, message)
    );
  } else {
    sendError(bot, msg.chat.id, 'Помилка: некоректне посилання!');
  }
}

const updateProgress = async (chatId, bot, messageId, current, total) => {
  try {
    await bot.editMessageText(`Парсинг... ${current}/${total}`, {
      chat_id: chatId,
      message_id: messageId,
    });
    // same in console
    console.log(`Парсинг... ${current}/${total}`);
  } catch (error) {
    console.warn('Error updating progress:', error);
  }
};

const sendFile = async (bot, chatId, filePath) => {
  try {
    fs.access(filePath, fs.constants.R_OK, (err) => {
      if (err) {
        console.error('PDF file is not accessible:', err);
      } else {
        console.log('PDF file is accessible, proceeding to send.');
      }
    });

    await bot.sendMessage(chatId, `Готово! Завантажую PDF...`);
    await bot.sendDocument(chatId, fs.createReadStream(filePath));

    // remove file after sending
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Failed to remove PDF file:', err);
      } else {
        console.log('PDF file removed successfully.');
      }
    });
  } catch (error) {
    console.error('Failed to send PDF to Telegram:', error.message);
    if (error.response) {
      console.error('Telegram API Response:', error.response.data);
    }
  }
};

const showProgress = async (bot, chatId) => {
  try {
    const message = await bot.sendMessage(chatId, `Починаю парсинг...`);

    return (current, total) =>
      current === 'DONE'
        ? finishParse()
        : updateProgress(chatId, bot, message.message_id, current, total);
  } catch (err) {
    console.warn('Error showing progress:', err);
  }
};

const finishParse = async () => {
  try {
    console.log('DONE');
  } catch (error) {
    console.warn('Error finishing parse:', error);
  }
};

const handleStart = async (msg, bot) => {
  try {
    await bot.sendMessage(
      msg.chat.id,
      `Привіт! Я бот, який парсить мангу з сайту manga.in.ua!\n\nВведіть команду /parse та посилання на сторінку з мангою.\n\nЦе обовʼязково має бути посилання на сторінку з мангою, а не список розділів!`
    );
  } catch (error) {
    console.warn('Error handling start:', error);
  }
};

const sendError = async (bot, chatId, error) => {
  await bot.sendMessage(chatId, `Помилка: ${error}`);
};

module.exports = {
  getMessage,
  setCommands,
  showProgress,
};
