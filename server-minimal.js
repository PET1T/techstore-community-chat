const express = require('express');
const fs = require('fs/promises');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== Middleware ====================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ توجيه الصفحة الرئيسية
app.get('/', (req, res) => {
    res.redirect('/community-chat.html');
});

const COMMUNITY_MESSAGES_FILE = './community-messages.json';
const COMMUNITY_USERS_FILE = './community-users.json';

// ... باقي الكود كما هو

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
        
        // الاحتفاظ بآخر 500 رسالة فقط
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
        
        // إزالة المستخدمين غير النشطين (أكثر من 2 دقيقة)
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

// مسح جميع الرسائل (للإدارة)
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

// ==================== إنشاء ملفات JSON ====================
async function initializeCommunityFiles() {
    try {
        try {
            await fs.access(COMMUNITY_MESSAGES_FILE);
        } catch {
            await writeCommunityMessages({ messages: [] });
            console.log('✅ تم إنشاء ملف community-messages.json');
        }
        
        try {
            await fs.access(COMMUNITY_USERS_FILE);
        } catch {
            await writeCommunityUsers({ users: [] });
            console.log('✅ تم إنشاء ملف community-users.json');
        }
    } catch (error) {
        console.error('❌ خطأ في إنشاء ملفات المجتمع:', error);
    }
}

// ==================== بدء السيرفر ====================
app.listen(PORT, async () => {
    console.log('='.repeat(50));
    console.log('🚀 السيرفر يعمل على: http://localhost:' + PORT);
    console.log('💬 Community Chat: http://localhost:' + PORT + '/community-chat.html');
    console.log('='.repeat(50));
    
    await initializeCommunityFiles();
});