async function enforceWork() {
    // 買い物ページなどは除外（念のための二重チェック）
    if (!location.href.includes('/video/') && !location.href.includes('/Prime-Video')) {
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/check-unlock');
        const data = await response.json();

        if (!data.is_unlocked) {
            // 既存のオーバーレイがあれば削除して作り直す
            const oldOverlay = document.getElementById('gatekeeper-overlay');
            if (oldOverlay) oldOverlay.remove();

            const overlay = document.createElement('div');
            overlay.id = 'gatekeeper-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.98); z-index: 2147483647;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                color: white; font-family: "Hiragino Kaku Gothic ProN", sans-serif; text-align: center;
            `;

            overlay.innerHTML = `
                <h1 style="font-size: 2.5em;">🚫 Prime Video 制限中 🚫</h1>
                <p style="font-size: 1.2em; margin: 20px;">
                    今日のノルマ（GitHub / Qiita）が未達成です。<br>
                    作業を終えてから楽しみましょう。
                </p>
                <img src="https://ghchart.rshah.org/ISHIKAWAMasahito" style="background: white; padding: 10px; border-radius: 5px;">
                <button onclick="location.reload()" style="margin-top: 30px; padding: 12px 24px; cursor: pointer; background: #2ea44f; color: white; border: none; border-radius: 5px; font-weight: bold;">
                    達成したので再読み込みする
                </button>
            `;
            document.documentElement.appendChild(overlay); // bodyがない場合を考慮
        }
    } catch (e) {
        console.error("Gatekeeper Server is offline.");
    }
}

// 初回実行
enforceWork();

// SPA対策：URLが変わったときもチェック
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        enforceWork();
    }
}).observe(document, {subtree: true, childList: true});