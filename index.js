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
const userOrders = {}; // Для отслеживания количества заказов

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
  const today = new Date().toISOString().split('T')[0]; // Текущая дата

  if (!users[userId]) return;

  // Регистрация
  if (users[userId].step === 'register') {
    users[userId] = {
      name: text,
      step: 'main',
      orders: [],
      date: today
    };
    userOrders[userId] = { date: today, count: 0 };
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
    if (users[userId].timeSlot) {
      // Освобождаем место
      timeSlots[users[userId].timeSlot].current--;
      
      // Уведомление админу
      const cancelText = `❌ Пользователь ${users[userId].name} (@${msg.from.username || 'нет юзернейма'}) отменил заказ!\n` +
                       `Освободилось место на ${users[userId].timeSlot}`;
      bot.sendMessage('5266215596', cancelText);
      
      // Уменьшаем счетчик заказов
      if (userOrders[userId] && userOrders[userId].date === today) {
        userOrders[userId].count = Math.max(0, userOrders[userId].count - 1);
      }
      
      bot.sendMessage(chatId, '❌ Ваш заказ отменен! Место освобождено.', mainMenu);
      users[userId].timeSlot = null;
      users[userId].orders = [];
    } else {
      bot.sendMessage(chatId, 'У вас нет активного заказа для отмены.', mainMenu);
    }
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
      // Проверка лимита заказов
      if (userOrders[userId] && userOrders[userId].date === today && userOrders[userId].count >= 2) {
        bot.sendMessage(chatId, '❌ Вы уже сделали максимальное количество заказов (2) на сегодня!', mainMenu);
        return;
      }

      if (timeSlots[text].current >= timeSlots[text].max) {
        bot.sendMessage(chatId, `❌ Все места на ${text} заняты! Выберите другое время.`, timeMenu);
      } else {
        timeSlots[text].current++;
        
        // Обновляем счетчик заказов
        if (!userOrders[userId]) userOrders[userId] = { date: today, count: 0 };
        if (userOrders[userId].date !== today) {
          userOrders[userId] = { date: today, count: 1 };
        } else {
          userOrders[userId].count++;
        }

        // Сохраняем время
        users[userId].timeSlot = text;
        
        // Уведомление пользователю
        bot.sendMessage(chatId, `✅ Заказ принят!\nВремя: ${text}\nОсталось мест: ${timeSlots[text].max - timeSlots[text].current}`, mainMenu);
        
        // Уведомление админу
        const orderText = `Новый заказ от ${users[userId].name} (@${msg.from.username || 'нет юзернейма'})\n` +
                         `Блюда: ${users[userId].orders.join(', ')}\n` +
                         `Время: ${text}\n` +
                         `Осталось мест: ${timeSlots[text].max - timeSlots[text].current}\n` +
                         `Заказов сегодня: ${userOrders[userId].count}/2`;
        bot.sendMessage('5266215596', orderText);
        
        // Сбрасываем заказ
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
