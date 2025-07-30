const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8293319216:AAHV2jguaERB-_PMFJcjvh3tCyBMIwRM9rQ'; // Твой токен
const bot = new TelegramBot(token, { polling: false });

// База данных (вместо БД используем объект)
const users = {};
const timeSlots = {
  '14:00': { max: 10, current: 0 },
  '15:00': { max: 10, current: 0 }
};
const userDailyOrders = {}; // { userId: { date: 'YYYY-MM-DD', count: 0 } }

// Клавиатуры
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🍽️ Меню'],
      ['❌ Отменить заказ']
    ],
    resize_keyboard: true
  }
};

const foodMenu = {
  reply_markup: {
    keyboard: [
      ['Борщ', 'Щроб'],
      ['Борщик', 'Борщище'],
      ['Борщииии'],
      ['⬅️ Назад']
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

// Обработчик /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!users[userId]) {
    bot.sendMessage(chatId, 'Введите имя и фамилию (например: Иван Иванов)');
    users[userId] = { step: 'register' };
  } else {
    showMainMenu(chatId);
  }
});

// Показ главного меню
function showMainMenu(chatId) {
  bot.sendMessage(chatId, 'Главное меню:', mainMenu);
}

// Обработка сообщений
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
  // Отмена заказа
  else if (text === '❌ Отменить заказ') {
    if (users[userId].timeSlot) {
      timeSlots[users[userId].timeSlot].current--;
      users[userId].timeSlot = null;
      users[userId].orders = [];
      bot.sendMessage(chatId, 'Заказ отменен!', mainMenu);
    } else {
      bot.sendMessage(chatId, 'У вас нет активного заказа.', mainMenu);
    }
  }
  // Выбор блюд
  else if (users[userId].step === 'food' && ['Борщ', 'Щроб', 'Борщик', 'Борщище', 'Борщииии'].includes(text)) {
    if (users[userId].orders.length < 3) {
      users[userId].orders.push(text);
      bot.sendMessage(chatId, `✅ Добавлено: ${text}. Выбрано: ${users[userId].orders.join(', ')}`, foodMenu);
    } else {
      bot.sendMessage(chatId, '❌ Можно выбрать не больше 3 блюд!', foodMenu);
    }
  }
  // Выбор времени
  else if (users[userId].step === 'food' && text === 'Готово') {
    if (users[userId].orders.length === 0) {
      bot.sendMessage(chatId, '❌ Вы не выбрали ни одного блюда!', foodMenu);
    } else {
      bot.sendMessage(chatId, 'Выберите время:', timeMenu);
      users[userId].step = 'time';
    }
  }
  // Подтверждение времени
  else if (users[userId].step === 'time' && ['14:00', '15:00'].includes(text)) {
    const today = new Date().toISOString().split('T')[0];
    if (!userDailyOrders[userId]) userDailyOrders[userId] = { date: today, count: 0 };
    
    // Проверка на 2 заказа в день
    if (userDailyOrders[userId].date === today && userDailyOrders[userId].count >= 2) {
      bot.sendMessage(chatId, '❌ Ваша еда закончилась 🎉', mainMenu);
      return;
    }

    // Проверка свободных мест
    if (timeSlots[text].current >= timeSlots[text].max) {
      bot.sendMessage(chatId, '❌ Не успел 😈 Мест нет!', mainMenu);
      return;
    }

    // Бронируем место
    timeSlots[text].current++;
    users[userId].timeSlot = text;
    userDailyOrders[userId].count++;

    // Отправка заказа
    const orderText = `Новый заказ от ${users[userId].name} (@${msg.from.username || 'нет_юзернейма'})\n` +
                      `Время: ${text}\n` +
                      `Блюда: ${users[userId].orders.join(', ')}\n` +
                      `Осталось мест: ${timeSlots[text].max - timeSlots[text].current}`;
    
    bot.sendMessage('5266215596', orderText); // Твой ID
    bot.sendMessage(chatId, `✅ Заказ принят! Время: ${text}\nОсталось мест: ${timeSlots[text].max - timeSlots[text].current}`, mainMenu);
    
    users[userId].orders = [];
    users[userId].step = 'main';
  }
  // Назад
  else if (text === '⬅️ Назад') {
    showMainMenu(chatId);
    users[userId].step = 'main';
  }
});

// Для Render
app.use(express.json());
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Бот запущен!');
});
