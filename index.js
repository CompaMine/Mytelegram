const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8293319216:AAHV2jguaERB-_PMFJcjvh3tCyBMIwRM9rQ'; // Твой токен
const bot = new TelegramBot(token, { polling: false }); // Polling отключен для Render

// База данных в памяти (для демо)
const users = {};

// Клавиатура
const foodMenu = {
  reply_markup: {
    keyboard: [
      ['Борщ', 'Щроб'],
      ['Борщик', 'Борщище'],
      ['Борщииии'],
      ['Готово']
    ],
    resize_keyboard: true
  }
};

// Обработчик /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!users[userId]) {
    bot.sendMessage(chatId, 'Введите имя и фамилию (например: Иван Иванов)');
    users[userId] = { step: 'register', orders: [] };
  } else {
    bot.sendMessage(chatId, 'Выберите блюдо (до 3):', foodMenu);
  }
});

// Обработка сообщений
bot.on('message', (msg) => {
  if (msg.text === '/start') return; // Игнорируем повторный /start

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!users[userId]) return;

  // Регистрация
  if (users[userId].step === 'register') {
    users[userId] = {
      name: text,
      step: 'menu',
      orders: []
    };
    bot.sendMessage(chatId, `Привет, ${text}! Выберите блюдо:`, foodMenu);
    return;
  }

  // Выбор блюд
  if (['Борщ', 'Щроб', 'Борщик', 'Борщище', 'Борщииии'].includes(text)) {
    if (users[userId].orders.length < 3) {
      users[userId].orders.push(text);
      bot.sendMessage(chatId, `✅ Добавлено: ${text}. Выбрано: ${users[userId].orders.join(', ')}`, foodMenu);
    } else {
      bot.sendMessage(chatId, '❌ Можно выбрать не больше 3 блюд!', foodMenu);
    }
  }

  // Отправка заказа
  if (text === 'Готово' && users[userId].orders.length > 0) {
    const orderText = `Новый заказ от ${users[userId].name} (@${msg.from.username || 'нет_юзернейма'}), выбор: ${users[userId].orders.join(', ')}`;
    bot.sendMessage('5266215596', orderText); // Твой ID
    bot.sendMessage(chatId, '🍽️ Заказ отправлен! Спасибо!');
    users[userId].orders = [];
  }
});

// Для Render: веб-сервер должен быть запущен
app.listen(process.env.PORT || 3000, () => {
  console.log('Бот запущен!');
});

// Включаем обработку обновлений через вебхук (для Render)
app.post('/webhook', express.json(), (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
