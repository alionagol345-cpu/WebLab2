const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Налаштування мідлварів
app.use(cors());
app.use(express.json());

// Робимо папку з .html файлами статичною, щоб вони відкривалися через сервер
app.use(express.static(path.join(__dirname)));

// Підключення до бази даних SQLite
const db = new sqlite3.Database('./alarms.db', (err) => {
    if (err) {
        console.error('Помилка підключення до БД:', err.message);
    } else {
        console.log('Підключено до бази даних SQLite.');
    }
});

// Створення таблиці для будильників, якщо вона не існує
db.run(`CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    time TEXT NOT NULL,
    date TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// Створення таблиці користувачів
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    gender TEXT,
    dob TEXT,
    password TEXT
)`);

// API: Реєстрація нового користувача
app.post('/api/register', (req, res) => {
    const { name, email, gender, dob, password } = req.body;
    const query = "INSERT INTO users (name, email, gender, dob, password) VALUES (?, ?, ?, ?, ?)";
    
    db.run(query, [name, email, gender, dob, password], function(err) {
        if (err) {
            // Помилка 19 в SQLite зазвичай означає порушення унікальності (UNIQUE constraint)
            return res.status(400).json({ error: "Користувач з таким email вже існує." });
        }
        res.json({ success: true, userId: this.lastID });
    });
});

// API: Вхід до системи
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    // Додаємо gender та dob у список того, що ми вибираємо з бази
    const query = "SELECT id, name, email, gender, dob FROM users WHERE email = ? AND password = ?";
    
    db.get(query, [email, password], (err, row) => {
        if (err || !row) {
            return res.status(401).json({ error: "Невірний email або пароль." });
        }
        res.json({ success: true, user: row });
    });
});

// Отримати список будильників конкретного користувача
app.get('/api/alarms', (req, res) => {
    const userId = req.query.userId;
    db.all("SELECT * FROM alarms WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Додати новий будильник для конкретного користувача
app.post('/api/alarms', (req, res) => {
    const { time, date, userId } = req.body;
    const query = "INSERT INTO alarms (time, date, user_id, active) VALUES (?, ?, ?, 1)";
    db.run(query, [time, date, userId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, time, date, active: 1 });
    });
});

// Змінити статус будильника (увімкнено/вимкнено)
app.patch('/api/alarms/:id', (req, res) => {
    const { active } = req.body;
    const query = "UPDATE alarms SET active = ? WHERE id = ?";
    db.run(query, [active, req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ updated: this.changes });
    });
});

// Видалити будильник
app.delete('/api/alarms/:id', (req, res) => {
    db.run("DELETE FROM alarms WHERE id = ?", req.params.id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});

// API: Оновлення профілю користувача
app.put('/api/profile/:id', (req, res) => {
    const { name, email, gender, dob } = req.body;
    const query = "UPDATE users SET name = ?, email = ?, gender = ?, dob = ? WHERE id = ?";
    
    db.run(query, [name, email, gender, dob, req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: "Помилка при оновленні або email вже зайнятий." });
        }
        res.json({ success: true });
    });
});

// API: Оновити дані будильника (час та дата)
app.put('/api/alarms/:id', (req, res) => {
    const { time, date } = req.body;
    const query = "UPDATE alarms SET time = ?, date = ? WHERE id = ?";
    db.run(query, [time, date, req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер працює на http://localhost:${PORT}`);
});