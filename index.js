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
      ['⏰ Напоминания | BETA']
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
    keyboard: [
      ['📅 Установить дату'],
      ['✅ Включить', '❌ Выключить'],
      ['✏️ Изменить время'],
      ['⬅️ Назад']
    ],
    resize_keyboard: true
  }
};

// Обработчик команды /start
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

// Обработчик команды "Блюда"
bot.onText(/Блюда/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  bot.sendMessage(chatId, 'Введите пароль для доступа к редактированию меню:');
  users[userId] = { ...users[userId], step: 'waiting_password' };
});

// Проверка напоминаний
setInterval(() => {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = `${currentHours}:${currentMinutes.toString().padStart(2, '0')}`;
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentDate = `${currentDay}.${currentMonth}`;

  for (const userId in reminders) {
    const reminder = reminders[userId];
    if (!reminder || !reminder.active) continue;

    const reminderTime = reminder.time;
    const reminderDate = reminder.date;
    
    // Проверяем совпадение времени
    const timeMatches = reminderTime === currentTime;
    
    // Проверяем совпадение даты (если указана) или каждый день
    const dateMatches = !reminderDate || reminderDate === currentDate;
    
    // Проверяем, не отправляли ли уже сегодня
    const notSentToday = !reminder.lastSent || reminder.lastSent !== currentDate;

    if (timeMatches && dateMatches && notSentToday) {
      bot.sendMessage(userId, `⏰ Напоминание! Пора сделать заказ!`);
      reminders[userId].lastSent = currentDate;
    }
  }
}, 60000); // Проверка каждую минуту

// Обработка всех сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentDate = `${currentDay}.${currentMonth}`;

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
      let reminderInfo = `Текущее напоминание:\n`;
      reminderInfo += `⏰ Время: ${reminders[userId].time}\n`;
      reminderInfo += `📅 Дата: ${reminders[userId].date || 'Каждый день'}\n`;
      reminderInfo += `Статус: ${reminders[userId].active ? '✅ Включено' : '❌ Выключено'}`;
      
      bot.sendMessage(chatId, reminderInfo, reminderMenu);
      users[userId].step = 'reminder_menu';
    } else {
      bot.sendMessage(chatId, 'Введите время напоминания в формате ЧЧ:ММ (например: 13:07)');
      users[userId].step = 'set_reminder_time';
    }
    return;
  }

  // Установка времени напоминания
  if (users[userId].step === 'set_reminder_time') {
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text)) {
      reminders[userId] = {
        time: text,
        date: null,
        active: false,
        lastSent: null
      };
      bot.sendMessage(chatId, 
        `Время напоминания установлено на ${text}.\n` +
        `Хотите установить конкретную дату? (например: 15.07)\n` +
        `Или напишите "Каждый день" для ежедневных напоминаний`,
        reminderMenu
      );
      users[userId].step = 'set_reminder_date';
    } else {
      bot.sendMessage(chatId, 'Неверный формат времени. Введите в формате ЧЧ:ММ (например: 13:07)');
    }
    return;
  }

  // Установка даты напоминания
  if (users[userId].step === 'set_reminder_date') {
    if (/^\d{1,2}\.\d{1,2}$/.test(text)) {
      const [day, month] = text.split('.');
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      
      if (dayNum > 0 && dayNum <= 31 && monthNum > 0 && monthNum <= 12) {
        reminders[userId].date = text;
        bot.sendMessage(chatId, 
          `Дата напоминания установлена на ${text} в ${reminders[userId].time}.\n` +
          `Активировать напоминание?`,
          reminderMenu
        );
        users[userId].step = 'reminder_menu';
      } else {
        bot.sendMessage(chatId, 'Неверная дата. Введите дату в формате ДД.ММ (например: 15.07)');
      }
    } else if (text.toLowerCase().includes('каждый день')) {
      reminders[userId].date = null;
      bot.sendMessage(chatId, 
        `Напоминание будет приходить каждый день в ${reminders[userId].time}.\n` +
        `Активировать?`,
        reminderMenu
      );
      users[userId].step = 'reminder_menu';
    } else {
      reminders[userId].date = null;
      bot.sendMessage(chatId, 
        `Напоминание будет приходить каждый день в ${reminders[userId].time}.\n` +
        `Активировать?`,
        reminderMenu
      );
      users[userId].step = 'reminder_menu';
    }
    return;
  }

  // Меню управления напоминаниями
  if (users[userId].step === 'reminder_menu') {
    if (text === '📅 Установить дату') {
      bot.sendMessage(chatId, 'Введите дату в формате ДД.ММ (например: 15.07) или "Каждый день"');
      users[userId].step = 'set_reminder_date';
      return;
    }
    else if (text === '✏️ Изменить время') {
      bot.sendMessage(chatId, 'Введите новое время в формате ЧЧ:ММ (например: 13:07)');
      users[userId].step = 'set_reminder_time';
      return;
    }
    else if (text === '✅ Включить') {
      reminders[userId].active = true;
      bot.sendMessage(chatId, 
        `Напоминание включено!\n` +
        `⏰ Время: ${reminders[userId].time}\n` +
        `📅 Дата: ${reminders[userId].date || 'Каждый день'}`,
        mainMenu
      );
      users[userId].step = 'main';
      return;
    }
    else if (text === '❌ Выключить') {
      reminders[userId].active = false;
      bot.sendMessage(chatId, 'Напоминание выключено!', mainMenu);
      users[userId].step = 'main';
      return;
    }
    else if (text === '⬅️ Назад') {
      showMainMenu(chatId);
      users[userId].step = 'main';
      return;
    }
  }

  // Регистрация
  if (users[userId].step === 'register') {
    users[userId] = {
      name: text,
      step: 'main',
      orders: [],
      date: currentDate,
      username: msg.from.username
    };
    userOrders[userId] = { date: currentDate, count: 0, orders: [] };
    showMainMenu(chatId);
    return;
  }

  // Главное меню
  if (text === '🍽️ Меню') {
    if (userOrders[userId] && userOrders[userId].date === currentDate && userOrders[userId].count >= 2) {
      bot.sendMessage(chatId, '❌ Вы уже сделали максимальное количество заказов (2) на сегодня!', mainMenu);
    } else {
      bot.sendMessage(chatId, 'Выберите блюдо (до 3):', foodMenu);
      users[userId].step = 'food';
    }
  }

  // Отмена заказа
  else if (text === '❌ Отменить заказ') {
    if (userOrders[userId] && userOrders[userId].date === currentDate && userOrders[userId].count > 0) {
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
      if (userOrders[userId] && userOrders[userId].date === currentDate && userOrders[userId].count >= 2) {
        bot.sendMessage(chatId, '❌ Вы уже сделали максимальное количество заказов (2) на сегодня!', mainMenu);
        return;
      }

      if (timeSlots[text].current >= timeSlots[text].max) {
        bot.sendMessage(chatId, `❌ Все места на ${text} заняты! Выберите другое время.`, timeMenu);
      } else {
        timeSlots[text].current++;
        
        if (!userOrders[userId]) userOrders[userId] = { date: currentDate, count: 0, orders: [] };
        if (userOrders[userId].date !== currentDate) {
          userOrders[userId] = { date: currentDate, count: 1, orders: [{ items: [...users[userId].orders], time: text }] };
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

// Функция отмены заказа
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

// Обновление меню блюд
function updateFoodMenu() {
  foodMenu.reply_markup.keyboard = [
    [menuItems[0], menuItems[1]],
    [menuItems[2], menuItems[3]],
    [menuItems[4]],
    ['✅ Готово', '⬅️ Назад']
  ];
}

// Показать главное меню
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
