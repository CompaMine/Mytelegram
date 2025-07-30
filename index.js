const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();
const cron = require('node-cron');

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
let lastRestartTime = new Date();

// Клавиатуры
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🍽️ Меню'],
      ['❌ Отменить заказ'],
      ['⏰ Напоминания | BETA'],
      ['✏️ Сменить ник']
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
      ['⏰ Установить время'],
      ['📅 Установить дату'],
      ['✅ Активировать', '❌ Деактивировать'],
      ['🗑️ Удалить напоминание'],
      ['⬅️ Назад']
    ],
    resize_keyboard: true
  }
};

// Уведомление о перезагрузке
function notifyAboutRestart() {
  const restartTime = lastRestartTime.toLocaleTimeString();
  const restartDate = lastRestartTime.toLocaleDateString();
  
  for (const userId in users) {
    if (users[userId] && users[userId].step !== 'register') {
      bot.sendMessage(
        userId,
        `🔄 Бот был перезагружен и снова онлайн!\n` +
        `Последнее обновление: ${restartDate} в ${restartTime}\n` +
        `Что нового:\n` +
        `- Добавлена функция смены ника\n` +
        `- Улучшена система напоминаний\n` +
        `- Исправлены мелкие ошибки`
      );
    }
  }
}

// Инициализация бота
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

// Секретная команда для редактирования меню
bot.onText(/Блюда/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  bot.sendMessage(chatId, 'Введите пароль для доступа к редактированию меню:');
  users[userId] = { ...users[userId], step: 'waiting_password' };
});

// Система напоминаний BETA
function setupReminder(userId, time, date) {
  if (reminders[userId]) {
    if (reminders[userId].task) {
      reminders[userId].task.stop();
    }
  }

  const [hours, minutes] = time.split(':').map(Number);
  let cronPattern;

  if (date) {
    const [day, month] = date.split('.').map(Number);
    cronPattern = `${minutes} ${hours} ${day} ${month} *`;
  } else {
    cronPattern = `${minutes} ${hours} * * *`;
  }

  reminders[userId] = {
    time,
    date: date || null,
    active: true,
    task: cron.schedule(cronPattern, () => {
      if (reminders[userId] && reminders[userId].active) {
        bot.sendMessage(userId, '⏰ Напоминание! Пора сделать заказ!');
      }
    })
  };
}

// Обработка сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const today = new Date();
  const currentDate = `${today.getDate()}.${today.getMonth() + 1}`;

  if (!users[userId]) return;

  // Смена ника
  if (text === '✏️ Сменить ник') {
    bot.sendMessage(chatId, 'Введите новое имя и фамилию:');
    users[userId].step = 'changing_name';
    return;
  }

  if (users[userId].step === 'changing_name') {
    users[userId].name = text;
    bot.sendMessage(chatId, `✅ Ваш ник успешно изменен на: ${text}`, mainMenu);
    users[userId].step = 'main';
    return;
  }

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

  // Напоминания BETA
  if (text === '⏰ Напоминания | BETA') {
    if (reminders[userId]) {
      let status = reminders[userId].active ? '✅ Активно' : '❌ Неактивно';
      let dateInfo = reminders[userId].date ? `Дата: ${reminders[userId].date}` : 'Повтор: Ежедневно';
      
      bot.sendMessage(chatId, 
        `Текущее напоминание:\n⏰ Время: ${reminders[userId].time}\n${dateInfo}\nСтатус: ${status}`,
        reminderMenu
      );
    } else {
      bot.sendMessage(chatId, 'Введите время напоминания в формате ЧЧ:ММ (например: 13:07)');
      users[userId].step = 'set_reminder_time';
    }
    return;
  }

  if (users[userId].step === 'set_reminder_time') {
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text)) {
      users[userId].reminderTime = text;
      bot.sendMessage(chatId, 
        `Время установлено на ${text}.\nХотите установить конкретную дату? (например: 15.07)\nИли напишите "Ежедневно"`,
        reminderMenu
      );
      users[userId].step = 'set_reminder_date';
    } else {
      bot.sendMessage(chatId, 'Неверный формат времени. Введите в формате ЧЧ:ММ (например: 13:07)');
    }
    return;
  }

  if (users[userId].step === 'set_reminder_date') {
    if (/^\d{1,2}\.\d{1,2}$/.test(text)) {
      const [day, month] = text.split('.');
      if (day > 0 && day <= 31 && month > 0 && month <= 12) {
        setupReminder(userId, users[userId].reminderTime, text);
        bot.sendMessage(chatId, 
          `Напоминание установлено на ${text} в ${users[userId].reminderTime}.\n` +
          `Статус: ✅ Активно`,
          reminderMenu
        );
      } else {
        bot.sendMessage(chatId, 'Неверная дата. Введите дату в формате ДД.ММ (например: 15.07)');
      }
    } else if (text.toLowerCase() === 'ежедневно') {
      setupReminder(userId, users[userId].reminderTime, null);
      bot.sendMessage(chatId, 
        `Ежедневное напоминание установлено на ${users[userId].reminderTime}.\n` +
        `Статус: ✅ Активно`,
        reminderMenu
      );
    }
    users[userId].step = 'main';
    return;
  }

  // Управление напоминаниями
  if (text === '⏰ Установить время') {
    bot.sendMessage(chatId, 'Введите новое время в формате ЧЧ:ММ (например: 13:07)');
    users[userId].step = 'set_reminder_time';
    return;
  }

  if (text === '📅 Установить дату') {
    bot.sendMessage(chatId, 'Введите дату в формате ДД.ММ (например: 15.07) или "Ежедневно"');
    users[userId].step = 'set_reminder_date';
    return;
  }

  if (text === '✅ Активировать' && reminders[userId]) {
    reminders[userId].active = true;
    bot.sendMessage(chatId, 'Напоминание активировано!', reminderMenu);
    return;
  }

  if (text === '❌ Деактивировать' && reminders[userId]) {
    reminders[userId].active = false;
    bot.sendMessage(chatId, 'Напоминание деактивировано!', reminderMenu);
    return;
  }

  if (text === '🗑️ Удалить напоминание' && reminders[userId]) {
    if (reminders[userId].task) {
      reminders[userId].task.stop();
    }
    delete reminders[userId];
    bot.sendMessage(chatId, 'Напоминание удалено!', mainMenu);
    return;
  }

  if (text === '⬅️ Назад') {
    showMainMenu(chatId);
    users[userId].step = 'main';
    return;
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
  lastRestartTime = new Date();
  setTimeout(notifyAboutRestart, 5000); // Уведомление через 5 секунд после запуска
});
