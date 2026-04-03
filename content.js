// アマプラ監視と遮断
async function enforceWork() {
    try {
        const response = await fetch('http://localhost:3000/api/check-unlock');
        const data = await response.json();

        // 解禁されていない（草が生えていない）場合に画面を隠す
        if (!data.is_unlocked) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.97); z-index: 2147483647;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                color: white; font-family: sans-serif; text-align: center;
            `;

            overlay.innerHTML = `
                <h1 style="font-size: 3em; margin-bottom: 0.5em;">🚫 視聴制限中 🚫</h1>
                <p style="font-size: 1.5em; max-width: 700px; line-height: 1.6; margin-bottom: 2em;">
                    今日の草が生えていません。<br>
                    アニメを見る前に、未来の自分に投資しましょう。
                </p>
                <div id="github-graph">
                    <p style="margin-bottom: 10px; color: #888;">Current GitHub Status:</p>
                    <img src="https://ghchart.rshah.org/ISHIKAWAMasahito" alt="GitHub Grass" 
                         style="background: white; padding: 20px; border-radius: 10px;">
                </div>
                <button onclick="location.reload()" style="margin-top: 40px; padding: 10px 20px; cursor: pointer; border-radius: 5px; border: none; background: #2ea44f; color: white; font-weight: bold;">
                    更新を確認する
                </button>
            `;
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden'; 
        }
    } catch (e) {
        console.error("Gatekeeper Serverに接続できません。");
    }
}

enforceWork();