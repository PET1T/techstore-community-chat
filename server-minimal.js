const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== Middleware ====================
app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

console.log('📁 Public directory:', publicPath);

// Logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});

const COMMUNITY_MESSAGES_FILE = './community-messages.json';
const COMMUNITY_USERS_FILE = './community-users.json';

// ==================== Helper Functions ====================
async function readCommunityMessages() {
    try {
        const data = await fs.readFile(COMMUNITY_MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { messages: [] };
    }
}

async function writeCommunityMessages(data) {
    await fs.writeFile(COMMUNITY_MESSAGES_FILE, JSON.stringify(data, null, 2));
}

async function readCommunityUsers() {
    try {
        const data = await fs.readFile(COMMUNITY_USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { users: [] };
    }
}

async function writeCommunityUsers(data) {
    await fs.writeFile(COMMUNITY_USERS_FILE, JSON.stringify(data, null, 2));
}

// ==================== Test Endpoint ====================
app.get('/test-files', async (req, res) => {
    try {
        const files = await fs.readdir(publicPath);
        res.json({
            success: true,
            publicDir: publicPath,
            files: files,
            htmlExists: files.includes('community-chat.html')
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message,
            publicDir: publicPath 
        });
    }
});

// ==================== Community Chat API ====================

// جلب جميع الرسائل
app.get('/api/community-chat/messages', async (req, res) => {
    try {
        const data = await readCommunityMessages();
        const sortedMessages = data.messages.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        res.json({ messages: sortedMessages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'فشل في جلب الرسائل' });
    }
});

// إضافة رسالة جديدة
app.post('/api/community-chat/messages', async (req, res) => {
    try {
        const { userId, userName, message, timestamp } = req.body;
        
        if (!userId || !userName || !message) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }
        
        const data = await readCommunityMessages();
        
        const newMessage = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            userId: userId,
            userName: userName.substring(0, 50),
            message: message.substring(0, 500),
            timestamp: timestamp || new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        data.messages.push(newMessage);
        
        if (data.messages.length > 500) {
            data.messages = data.messages.slice(-500);
        }
        
        await writeCommunityMessages(data);
        
        console.log('✅ تمت إضافة رسالة:', newMessage.userName);
        res.status(201).json({ 
            success: true, 
            message: newMessage 
        });
    } catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json({ error: 'فشل في إضافة الرسالة' });
    }
});

// حذف رسالة
app.delete('/api/community-chat/messages/:id', async (req, res) => {
    try {
        const data = await readCommunityMessages();
        const messageId = req.params.id;
        
        const index = data.messages.findIndex(m => m.id === messageId);
        
        if (index === -1) {
            return res.status(404).json({ error: 'الرسالة غير موجودة' });
        }
        
        data.messages.splice(index, 1);
        await writeCommunityMessages(data);
        
        res.json({ 
            success: true, 
            message: 'تم حذف الرسالة بنجاح' 
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'فشل في حذف الرسالة' });
    }
});

// تحديث نشاط المستخدم
app.post('/api/community-chat/users/activity', async (req, res) => {
    try {
        const { userId, userName, lastActivity } = req.body;
        
        if (!userId || !userName) {
            return res.status(400).json({ error: 'البيانات غير مكتملة' });
        }
        
        const data = await readCommunityUsers();
        const userIndex = data.users.findIndex(u => u.userId === userId);
        
        const userInfo = {
            userId: userId,
            userName: userName.substring(0, 50),
            lastActivity: lastActivity || Date.now()
        };
        
        if (userIndex === -1) {
            data.users.push(userInfo);
        } else {
            data.users[userIndex] = userInfo;
        }
        
        const now = Date.now();
        data.users = data.users.filter(u => 
            now - u.lastActivity < 2 * 60 * 1000
        );
        
        await writeCommunityUsers(data);
        
        res.json({ 
            success: true,
            user: userInfo
        });
    } catch (error) {
        console.error('Error updating activity:', error);
        res.status(500).json({ error: 'فشل في تحديث النشاط' });
    }
});

// جلب المستخدمين المتصلين
app.get('/api/community-chat/users/online', async (req, res) => {
    try {
        const data = await readCommunityUsers();
        
        const now = Date.now();
        const activeUsers = data.users.filter(u => 
            now - u.lastActivity < 2 * 60 * 1000
        );
        
        data.users = activeUsers;
        await writeCommunityUsers(data);
        
        res.json({ 
            users: activeUsers,
            count: activeUsers.length
        });
    } catch (error) {
        console.error('Error fetching online users:', error);
        res.status(500).json({ error: 'فشل في جلب المستخدمين' });
    }
});

// مسح جميع الرسائل
app.delete('/api/community-chat/messages', async (req, res) => {
    try {
        await writeCommunityMessages({ messages: [] });
        res.json({ 
            success: true, 
            message: 'تم مسح جميع الرسائل' 
        });
    } catch (error) {
        console.error('Error clearing messages:', error);
        res.status(500).json({ error: 'فشل في مسح الرسائل' });
    }
});

// إحصائيات المجتمع
app.get('/api/community-chat/stats', async (req, res) => {
    try {
        const messagesData = await readCommunityMessages();
        const usersData = await readCommunityUsers();
        
        const now = Date.now();
        const activeUsers = usersData.users.filter(u => 
            now - u.lastActivity < 2 * 60 * 1000
        );
        
        const stats = {
            totalMessages: messagesData.messages.length,
            onlineUsers: activeUsers.length,
            uniqueUsers: [...new Set(messagesData.messages.map(m => m.userId))].length,
            messagesLast24h: messagesData.messages.filter(m => 
                Date.now() - new Date(m.timestamp).getTime() < 24 * 60 * 60 * 1000
            ).length
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'فشل في جلب الإحصائيات' });
    }
});

// ==================== Root Redirect (قبل 404 مباشرة!) ====================
app.get('/', (req, res) => {
    console.log('🏠 Redirecting root to /community-chat.html');
    res.redirect('/community-chat.html');
});

// ==================== 404 Handler (في الآخر!) ====================
app.use((req, res) => {
    console.log('❌ 404 Not Found:', req.path);
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - الصفحة غير موجودة</title>
            <style>
                body {
                    font-family: 'Cairo', sans-serif;
                    background: linear-gradient(135deg, #0a0a0f 0%, #1a0f2e 100%);
                    color: #e0e0e0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    padding: 40px;
                    background: rgba(26, 15, 46, 0.6);
                    border-radius: 20px;
                    border: 2px solid rgba(138, 43, 226, 0.3);
                    max-width: 600px;
                }
                h1 { font-size: 72px; margin: 0; color: #8b5cf6; }
                p { font-size: 18px; margin: 15px 0; }
                code { 
                    background: rgba(0,0,0,0.4); 
                    padding: 5px 12px; 
                    border-radius: 6px;
                    color: #f59e0b;
                    font-size: 16px;
                }
                a {
                    display: inline-block;
                    padding: 15px 35px;
                    background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 12px;
                    margin-top: 25px;
                    transition: transform 0.3s, box-shadow 0.3s;
                    font-weight: 600;
                }
                a:hover { 
                    transform: translateY(-3px); 
                    box-shadow: 0 8px 20px rgba(138, 43, 226, 0.4);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404</h1>
                <p>⚠️ الصفحة التي تبحث عنها غير موجودة</p>
                <p>المسار المطلوب: <code>${req.path}</code></p>
                <a href="/community-chat.html">🏠 الذهاب إلى صفحة الدردشة</a>
            </div>
        </body>
        </html>
    `);
});

// ==================== إنشاء ملفات JSON ====================
async function initializeCommunityFiles() {
    try {
        try {
            await fs.access(COMMUNITY_MESSAGES_FILE);
            console.log('✅ ملف الرسائل موجود');
        } catch {
            await writeCommunityMessages({ messages: [] });
            console.log('✅ تم إنشاء ملف community-messages.json');
        }
        
        try {
            await fs.access(COMMUNITY_USERS_FILE);
            console.log('✅ ملف المستخدمين موجود');
        } catch {
            await writeCommunityUsers({ users: [] });
            console.log('✅ تم إنشاء ملف community-users.json');
        }
        
        try {
            const files = await fs.readdir(publicPath);
            console.log('✅ ملفات في public/:', files.join(', '));
            
            if (files.includes('community-chat.html')) {
                console.log('✅✅ community-chat.html موجود ويعمل!');
            } else {
                console.error('❌❌ community-chat.html غير موجود في public/');
            }
        } catch (error) {
            console.error('❌ خطأ في قراءة مجلد public:', error.message);
        }
        
    } catch (error) {
        console.error('❌ خطأ في التهيئة:', error);
    }
}

// ==================== بدء السيرفر ====================
app.listen(PORT, async () => {
    console.log('='.repeat(60));
    console.log('🚀 السيرفر يعمل على المنفذ:', PORT);
    console.log('📁 مسار المجلد العام:', publicPath);
    console.log('🌐 الروابط المتاحة:');
    console.log('   - الصفحة الرئيسية: /');
    console.log('   - صفحة الدردشة: /community-chat.html');
    console.log('   - اختبار الملفات: /test-files');
    console.log('   - API الرسائل: /api/community-chat/messages');
    console.log('='.repeat(60));
    
    await initializeCommunityFiles();
});
