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

// 起動時に読み込み状況を確認（パスワードは防犯のため伏せ字）
console.log('--- DB Config Check ---');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASS:', process.env.DB_PASS ? '******** (Set)' : 'EMPTY');
console.log('-----------------------');

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
        console.log('--- Amazon Prime 制限チェック開始 ---');
        connection = await mysql.createConnection(dbConfig);
        const todayJST = getJSTDateString();

        // 1. 各サービスの最新状況を取得 
        const isCommitted = await checkGitHub();
        const isQiitaUpdated = await checkQiita();

        // 2. 解禁条件の判定 (どちらか一方でOKなら true)
        const canUnlock = isCommitted || isQiitaUpdated;

        // 3. DBの更新（is_unlocked 列も更新対象に含める） 
        await connection.execute(
            `INSERT INTO achievement_status (target_date, github_committed, qiita_updated, is_unlocked) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
                github_committed = ?, 
                qiita_updated = ?, 
                is_unlocked = ?`,
            [todayJST, isCommitted, isQiitaUpdated, canUnlock, isCommitted, isQiitaUpdated, canUnlock]
        );

        // 4. 最新の状態をレスポンスとして返す 
        console.log(`[判定結果] 解禁フラグ: ${canUnlock} (GitHub: ${isCommitted}, Qiita: ${isQiitaUpdated})`);
        
        res.json({ 
            is_unlocked: canUnlock,
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