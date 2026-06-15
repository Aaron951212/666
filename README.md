# BTC AI 自動分析平台

這是一個純前端的比特幣行情分析儀表板，支援即時價格、AI 行情分析、TradingView 風格 K 線圖、技術指標儀表板、Fear & Greed 市場情緒、AI 預測模組、價格警報以及本地存儲。

## 專案結構

- `index.html` - 主頁面檔案
- `styles.css` - 儀表板樣式
- `main.js` - 交易分析與 API 串接邏輯
- `README.md` - 專案說明

## 功能說明

1. 即時 BTC/USDT 報價與 24 小時漲跌幅、成交量、市值展示
2. AI 行情分析：RSI、MACD、EMA20、EMA50、ATR 和趨勢邏輯判斷
3. TradingView Lightweight Charts K 線圖切換 1H / 4H / 1D / 1W
4. 技術指標儀表板顯示 RSI、MACD、EMA、ATR、成交量
5. 市場情緒分析：Fear & Greed 指數顯示
6. AI 預測模組：1 小時、4 小時、24 小時市場方向預測
7. BTC 價格警報與本地儲存警報與分析歷史紀錄
8. 深色模式與響應式設計，支援桌機、平板與手機

## API 串接方法

- `https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT` - 取得 BTC/USDT 最新行情資料
- `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval={interval}&limit=100` - 取得 K 線資料，用於計算技術指標與繪製圖表
- `https://api.alternative.me/fng/?limit=1` - 取得 Fear & Greed 指數

## 安裝教學

此專案為純前端專案，無需安裝伺服器。

1. 將所有檔案放到同一資料夾。
2. 直接打開 `index.html` 即可在瀏覽器中執行。

## 本地測試

如果需要本地測試 HTTP 伺服器，可使用以下指令：

```bash
# Python 3
python3 -m http.server 8000
```

然後開啟瀏覽器：

```text
http://localhost:8000
```

## 部署教學

### GitHub Pages

1. 將檔案推送到 GitHub 儲存庫
2. 在 GitHub Pages 設定中選擇 `main` 分支的根目錄
3. 保存後即可使用 GitHub Pages 網址訪問

### Vercel

1. 登入 Vercel
2. 建立新專案，選擇儲存庫
3. 直接部署前端專案，根目錄即可
4. Vercel 會自動部署靜態網站

### Replit

1. 建立新的 Replit 專案，選擇 `HTML, CSS, JS`
2. 上傳 `index.html`、`styles.css`、`main.js`
3. 直接啟動即可在 Replit 上瀏覽

## 程式碼註解

程式碼已在 `main.js` 中加入邏輯註解，包含：

- API 端點定義
- 技術指標計算函式（EMA、RSI、MACD、ATR）
- 市場評級與建議邏輯
- 預測模組輸出與警報判斷
- 本地儲存歷史與警報
- 深色模式切換與圖表重新調整

## 注意事項

- 本專案不包含後端伺服器，所有資料直接從公開 API 讀取。
- 由於瀏覽器 CORS 與 Binance API 規則，請在支援 HTTPS 的環境和較新瀏覽器中執行。
- 所有策略僅供參考，非投資建議。
