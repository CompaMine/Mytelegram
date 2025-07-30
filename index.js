const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8293319216:AAHV2jguaERB-_PMFJcjvh3tCyBMIwRM9rQ';
const bot = new TelegramBot(token, { polling: false });

// База данных
const users = {};
const timeSlots = {
  '14:00': { max: 10, current: 0 },
  '15:00': { max: 10, current: 0 }
};

// Клавиатуры
const mainMenu = {
  reply_markup: {
    keyboard: [['🍽️ Меню'], ['❌ Отменить заказ']],
    resize_keyboard: true
  }
};

const foodMenu = {
  reply_markup: {
    keyboard: [
      ['Борщ', 'Щроб'],
      ['Борщик', 'Борщище'],
      ['Борщииии'],
      ['✅ Готово', '⬅️ Назад']
    ],
    resize_keyboard: true
  }
};

const timeMenu = {
  reply_markup: {
    keyboard: [
      ['14:00', '15:00'],
      ['⬅️ Назад']
    ],
    resize_keyboard: true
  }
};

// Обработчики
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (!users[userId]) {
    bot.sendMessage(chatId, 'Введите имя и фамилию:');
    users[userId] = { step: 'register' };
  } else {
    showMainMenu(chatId);
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!users[userId]) return;

  // Регистрация
  if (users[userId].step === 'register') {
    users[userId] = {
      name: text,
      step: 'main',
      orders: []
    };
    showMainMenu(chatId);
    return;
  }

  // Главное меню
  if (text === '🍽️ Меню') {
    bot.sendMessage(chatId, 'Выберите блюдо (до 3):', foodMenu);
    users[userId].step = 'food';
  }

  // Выбор блюд
  else if (users[userId].step === 'food') {
    if (['Борщ', 'Щроб', 'Борщик', 'Борщище', 'Борщииии'].includes(text)) {
      if (users[userId].orders.length < 3) {
        users[userId].orders.push(text);
        bot.sendMessage(chatId, `✅ Добавлено: ${text}\nВыбрано: ${users[userId].orders.join(', ')}`, foodMenu);
      } else {
        bot.sendMessage(chatId, '❌ Максимум 3 блюда!', foodMenu);
      }
    }
    else if (text === '✅ Готово') {
      if (users[userId].orders.length === 0) {
        bot.sendMessage(chatId, '❌ Выберите хотя бы 1 блюдо!', foodMenu);
      } else {
        bot.sendMessage(chatId, 'Выберите время:', timeMenu);
        users[userId].step = 'time';
      }
    }
    else if (text === '⬅️ Назад') {
      showMainMenu(chatId);
    }
  }

  // Выбор времени
  else if (users[userId].step === 'time') {
    if (['14:00', '15:00'].includes(text)) {
      if (timeSlots[text].current >= timeSlots[text].max) {
        bot.sendMessage(chatId, '❌ Все места заняты! Выберите другое время.', timeMenu);
      } else {
        timeSlots[text].current++;
        bot.sendMessage(chatId, `✅ Время ${text} выбрано!\nОтправляю заказ...`, mainMenu);
        
        // Отправка уведомления вам
        const orderText = `Новый заказ от ${users[userId].name}\n` +
                          `Блюда: ${users[userId].orders.join(', ')}\n` +
                          `Время: ${text}\n` +
                          `Осталось мест: ${timeSlots[text].max - timeSlots[text].current}`;
        bot.sendMessage('5266215596', orderText);
        
        users[userId].orders = [];
        users[userId].step = 'main';
      }
    }
    else if (text === '⬅️ Назад') {
      bot.sendMessage(chatId, 'Выберите блюдо:', foodMenu);
      users[userId].step = 'food';
    }
  }
});

// Запуск сервера
app.use(express.json());
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Сервер запущен!');
});

function showMainMenu(chatId) {
  bot.sendMessage(chatId, 'Главное меню:', mainMenu);
}
