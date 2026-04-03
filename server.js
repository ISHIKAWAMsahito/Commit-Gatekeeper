require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

// --- 設定エリア ---
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

const GITHUB_USER = process.env.GITHUB_USER;
// トークン前後の不要な空白などを除去
const QIITA_TOKEN = process.env.QIITA_TOKEN ? process.env.QIITA_TOKEN.trim() : '';
// ------------------------------------

/**
 * 日付文字列を日本時間（JST）の「YYYY-MM-DD」形式に変換する関数
 */
function getJSTDateString(dateString) {
    const d = dateString ? new Date(dateString) : new Date();
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        timeZone: 'Asia/Tokyo'
    });
    return formatter.format(d).replace(/\//g, '-');
}

/**
 * GitHubの活動判定ロジック
 */
async function checkGitHub() {
    try {
        const response = await axios.get(`https://api.github.com/users/${GITHUB_USER}/events`);
        const todayJST = getJSTDateString();
        
        const pushEvents = response.data.filter(e => {
            if (e.type !== 'PushEvent') return false;
            // GitHubのUTC時間をJSTに変換して比較
            const eventDateJST = getJSTDateString(e.created_at);
            return eventDateJST === todayJST;
        });

        if (pushEvents.length > 0) {
            console.log(`[GitHub] ✅ 今日のPushEventを ${pushEvents.length} 件確認しました！`);
            return true;
        } else {
            console.log(`[GitHub] ❌ 今日のPushEventがありません。（判定日: ${todayJST}）`);
            return false;
        }
    } catch (error) {
        console.error('[GitHub] API Error:', error.message);
        return false;
    }
}

/**
 * Qiitaの活動判定ロジック
 */
async function checkQiita() {
    if (!QIITA_TOKEN || QIITA_TOKEN === 'your_qiita_token_here') {
        console.log('[Qiita] トークン未設定のため判定をスキップします。');
        return false;
    }
    
    try {
        const response = await axios.get('https://api.qiita.com/api/v2/authenticated_user/items', {
            headers: { 'Authorization': `Bearer ${QIITA_TOKEN}` }
        });
        
        const latestArticle = response.data[0];
        if (!latestArticle) {
            console.log('[Qiita] ❌ 記事が見つかりません。');
            return false;
        }

        const todayJST = getJSTDateString();
        const articleDateJST = getJSTDateString(latestArticle.updated_at || latestArticle.created_at);
        const isUpdatedToday = articleDateJST === todayJST;
        const hasEnoughContent = latestArticle.body.length >= 500; 

        if (isUpdatedToday && hasEnoughContent) {
            console.log(`[Qiita] ✅ 今日の更新を確認！(文字数: ${latestArticle.body.length})`);
            return true;
        } else {
            console.log(`[Qiita] ❌ 条件未達成（更新日: ${articleDateJST}, 文字数: ${latestArticle.body.length}）`);
            return false;
        }
    } catch (error) {
        console.error(`[Qiita] API Error (${error.response ? error.response.status : 'Network Error'}): トークン設定を見直してください。`);
        return false;
    }
}

/**
 * 解禁状態をチェックし、DBを更新するAPI
 */
app.get('/api/check-unlock', async (req, res) => {
    let connection;
    try {
        console.log('--- 状態チェック開始 ---');
        connection = await mysql.createConnection(dbConfig);
        const todayJST = getJSTDateString();

        const isCommitted = await checkGitHub();
        const isQiitaUpdated = await checkQiita();

        await connection.execute(
            `INSERT INTO achievement_status (target_date, github_committed, qiita_updated) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE github_committed = ?, qiita_updated = ?`,
            [todayJST, isCommitted, isQiitaUpdated, isCommitted, isQiitaUpdated]
        );

        const [rows] = await connection.execute(
            'SELECT is_unlocked FROM achievement_status WHERE target_date = ?',
            [todayJST]
        );

        const isUnlocked = rows.length > 0 ? !!rows[0].is_unlocked : false;
        console.log(`[判定結果] 解禁フラグ: ${isUnlocked}`);
        
        res.json({ 
            is_unlocked: isUnlocked,
            github_status: isCommitted,
            qiita_status: isQiitaUpdated
        });
        
    } catch (error) {
        console.error('DB Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (connection) await connection.end();
    }
});

app.listen(3000, () => {
    console.log('🚀 Gatekeeper Server is running on http://localhost:3000');
});