/**
 * GitHubの活動判定ロジック（Contributions API 版）
 */
async function checkGitHub() {
    try {
        const url = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}`;
        const response = await axios.get(url);

        const todayJST = getJSTDateString();
        const todayData = response.data.contributions.find(c => c.date === todayJST);

        if (todayData && todayData.count > 0) {
            console.log(`[GitHub] ✅ 今日のコミットを確認！ (${todayData.count} contributions)`);
            return true;
        } else {
            console.log(`[GitHub] ❌ 今日のコミットなし (${todayJST})`);
            return false;
        }
    } catch (error) {
        console.error('[GitHub] API Error:', error.message);
        return false;
    }
}
