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
const userOrders = {};
const adminPassword = 'DOBRO123q';
const menuItems = ['Борщ', 'Котлетка', 'Пюрешка с сосиской❤️', 'Сок', 'Коктейль'];
const reminders = {}; // Для хранения напоминаний

// Клавиатуры
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🍽️ Меню'],
      ['❌ Отменить заказ'],
      ['⏰ Напоминания']
    ],
    resize_keyboard: true
  }
};

const foodMenu = {
  reply_markup: {
    keyboard: [
      [menuItems[0], menuItems[1]],
      [menuItems[2], menuItems[3]],
      [menuItems[4]],
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

const cancelMenu = {
  reply_markup: {
    keyboard: [['1', '2'], ['⬅️ Назад']],
    resize_keyboard: true
  }
};

const reminderMenu = {
  reply_markup: {
    keyboard: [['✅ Включить', '❌ Выключить'], ['⬅️ Назад']],
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

bot.onText(/Блюда/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Введите пароль для доступа к редактированию меню:');
  users[msg.from.id] = { ...users[msg.from.id], step: 'waiting_password' };
});

// Проверка напоминаний
setInterval(() => {
  const now = new Date();
  const currentTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentDate = `${now.getDate()}.${now.getMonth() + 1}`;

  for (const userId in reminders) {
    const reminder = reminders[userId];
    if (
      reminder.time === currentTime && 
      reminder.active && 
      (!reminder.lastSent || reminder.lastSent !== currentDate)
    ) {
      bot.sendMessage(userId, `⏰ Напоминание! Пора сделать заказ!`);
      reminders[userId].lastSent = currentDate;
    }
  }
}, 60000); // Проверка каждую минуту

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const today = new Date().toISOString().split('T')[0];

  if (!users[userId]) return;

  // Напоминания
  if (text === '⏰ Напоминания') {
    if (reminders[userId]) {
      bot.sendMessage(chatId, 
        `Текущее напоминание: ${reminders[userId].time}\n` +
        `Статус: ${reminders[userId].active ? '✅ Включено' : '❌ Выключено'}`,
        reminderMenu
      );
    } else {
      bot.sendMessage(chatId, 'Введите время напоминания в формате ЧЧ:ММ (например: 14:23)');
      users[userId].step = 'setting_reminder_time';
    }
    return;
  }

  if (users[userId].step === 'setting_reminder_time') {
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text)) {
      reminders[userId] = {
        time: text,
        active: false,
        lastSent: null
      };
      bot.sendMessage(chatId, `Напоминание установлено на ${text}. Включить?`, reminderMenu);
      users[userId].step = 'setting_reminder_status';
    } else {
      bot.sendMessage(chatId, 'Неверный формат времени. Введите в формате ЧЧ:ММ (например: 14:23)');
    }
    return;
  }

  if (users[userId].step === 'setting_reminder_status') {
    if (text === '✅ Включить') {
      reminders[userId].active = true;
      bot.sendMessage(chatId, `Напоминание на ${reminders[userId].time} включено!`, mainMenu);
    } else if (text === '❌ Выключить') {
      reminders[userId].active = false;
      bot.sendMessage(chatId, `Напоминание на ${reminders[userId].time} выключено!`, mainMenu);
    }
    users[userId].step = 'main';
    return;
  }

  // Остальные обработчики...
  // [Предыдущий код остается без изменений]
});

// [Остальные функции остаются без изменений]

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

function updateFoodMenu() {
  foodMenu.reply_markup.keyboard = [
    [menuItems[0], menuItems[1]],
    [menuItems[2], menuItems[3]],
    [menuItems[4]],
    ['✅ Готово', '⬅️ Назад']
  ];
                                               }
