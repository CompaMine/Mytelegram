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
const reminders = {};

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
  const userId = msg.from.id;
  bot.sendMessage(chatId, 'Введите пароль для доступа к редактированию меню:');
  users[userId] = { ...users[userId], step: 'waiting_password' };
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
}, 60000);

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const today = new Date().toISOString().split('T')[0];

  if (!users[userId]) return;

  // Редактирование меню
  if (users[userId].step === 'waiting_password') {
    if (text === adminPassword) {
      bot.sendMessage(chatId, 'Введите изменения в формате:\n1: Новое блюдо\n2: Другое блюдо\nИли просто номер для удаления\n"стоп" для выхода');
      users[userId].step = 'editing_menu';
    } else {
      bot.sendMessage(chatId, 'Неверный пароль!', mainMenu);
      users[userId].step = 'main';
    }
    return;
  }

  if (users[userId].step === 'editing_menu') {
    if (text.toLowerCase() === 'стоп') {
      showMainMenu(chatId);
      users[userId].step = 'main';
      return;
    }

    const parts = text.split(':');
    if (parts.length === 2) {
      const index = parseInt(parts[0]) - 1;
      if (index >= 0 && index < menuItems.length) {
        menuItems[index] = parts[1].trim();
        updateFoodMenu();
        bot.sendMessage(chatId, `Блюдо ${index + 1} изменено на: ${menuItems[index]}`);
      }
    } else if (!isNaN(text)) {
      const index = parseInt(text) - 1;
      if (index >= 0 && index < menuItems.length) {
        menuItems.splice(index, 1);
        updateFoodMenu();
        bot.sendMessage(chatId, `Блюдо ${index + 1} удалено`);
      }
    }
    return;
  }

  // Напоминания
  if (text === '⏰ Напоминания') {
    if (reminders[userId]) {
      bot.sendMessage(chatId, 
        `Текущее напоминание: ${reminders[userId].time}\n` +
        `Статус: ${reminders[userId].active ? '✅ Включено' : '❌ Выключено'}`,
        reminderMenu
      );
      users[userId].step = 'reminder_settings';
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

  if (users[userId].step === 'setting_reminder_status' || users[userId].step === 'reminder_settings') {
    if (text === '✅ Включить') {
      reminders[userId].active = true;
      bot.sendMessage(chatId, `Напоминание на ${reminders[userId].time} включено!`, mainMenu);
    } else if (text === '❌ Выключить') {
      reminders[userId].active = false;
      bot.sendMessage(chatId, `Напоминание на ${reminders[userId].time} выключено!`, mainMenu);
    } else if (text === '⬅️ Назад') {
      showMainMenu(chatId);
    }
    users[userId].step = 'main';
    return;
  }

  // Регистрация
  if (users[userId].step === 'register') {
    users[userId] = {
      name: text,
      step: 'main',
      orders: [],
      date: today,
      username: msg.from.username
    };
    userOrders[userId] = { date: today, count: 0, orders: [] };
    showMainMenu(chatId);
    return;
  }

  // Главное меню
  if (text === '🍽️ Меню') {
    if (userOrders[userId] && userOrders[userId].date === today && userOrders[userId].count >= 2) {
      bot.sendMessage(chatId, '❌ Вы уже сделали максимальное количество заказов (2) на сегодня!', mainMenu);
    } else {
      bot.sendMessage(chatId, 'Выберите блюдо (до 3):', foodMenu);
      users[userId].step = 'food';
    }
  }

  // Отмена заказа
  else if (text === '❌ Отменить заказ') {
    if (userOrders[userId] && userOrders[userId].date === today && userOrders[userId].count > 0) {
      if (userOrders[userId].count === 1) {
        cancelOrder(userId, chatId, 0);
      } else {
        bot.sendMessage(chatId, 'Какой заказ отменить?', cancelMenu);
        users[userId].step = 'canceling';
      }
    } else {
      bot.sendMessage(chatId, 'У вас нет активных заказов для отмены.', mainMenu);
    }
  }

  // Выбор заказа для отмены
  else if (users[userId].step === 'canceling') {
    if (['1', '2'].includes(text)) {
      cancelOrder(userId, chatId, parseInt(text) - 1);
    } else if (text === '⬅️ Назад') {
      showMainMenu(chatId);
    }
  }

  // Выбор блюд
  else if (users[userId].step === 'food') {
    if (menuItems.includes(text)) {
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
      if (userOrders[userId] && userOrders[userId].date === today && userOrders[userId].count >= 2) {
        bot.sendMessage(chatId, '❌ Вы уже сделали максимальное количество заказов (2) на сегодня!', mainMenu);
        return;
      }

      if (timeSlots[text].current >= timeSlots[text].max) {
        bot.sendMessage(chatId, `❌ Все места на ${text} заняты! Выберите другое время.`, timeMenu);
      } else {
        timeSlots[text].current++;
        
        if (!userOrders[userId]) userOrders[userId] = { date: today, count: 0, orders: [] };
        if (userOrders[userId].date !== today) {
          userOrders[userId] = { date: today, count: 1, orders: [{ items: [...users[userId].orders], time: text }] };
        } else {
          userOrders[userId].count++;
          userOrders[userId].orders.push({ items: [...users[userId].orders], time: text });
        }

        users[userId].timeSlot = text;
        
        bot.sendMessage(chatId, `✅ Заказ принят!\nВремя: ${text}\nОсталось мест: ${timeSlots[text].max - timeSlots[text].current}`, mainMenu);
        
        const orderText = `Новый заказ от ${users[userId].name} (@${users[userId].username || 'нет юзернейма'})\n` +
                         `Блюда: ${users[userId].orders.join(', ')}\n` +
                         `Время: ${text}\n` +
                         `Осталось мест: ${timeSlots[text].max - timeSlots[text].current}\n` +
                         `Заказов сегодня: ${userOrders[userId].count}/2`;
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

// Функции
function cancelOrder(userId, chatId, orderIndex) {
  if (userOrders[userId] && userOrders[userId].orders[orderIndex]) {
    const order = userOrders[userId].orders[orderIndex];
    timeSlots[order.time].current--;
    
    const cancelText = `❌ Пользователь ${users[userId].name} (@${users[userId].username || 'нет юзернейма'}) отменил заказ!\n` +
                     `Блюда: ${order.items.join(', ')}\n` +
                     `Время: ${order.time}\n` +
                     `Освободилось место на ${order.time}`;
    bot.sendMessage('5266215596', cancelText);
    
    userOrders[userId].orders.splice(orderIndex, 1);
    userOrders[userId].count--;
    
    bot.sendMessage(chatId, '❌ Ваш заказ отменен! Место освобождено.', mainMenu);
    users[userId].step = 'main';
  } else {
    bot.sendMessage(chatId, 'Ошибка отмены заказа.', mainMenu);
  }
}

function updateFoodMenu() {
  foodMenu.reply_markup.keyboard = [
    [menuItems[0], menuItems[1]],
    [menuItems[2], menuItems[3]],
    [menuItems[4]],
    ['✅ Готово', '⬅️ Назад']
  ];
}

function showMainMenu(chatId) {
  bot.sendMessage(chatId, 'Главное меню:', mainMenu);
}

// Запуск сервера
app.use(express.json());
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Сервер запущен!');
});
