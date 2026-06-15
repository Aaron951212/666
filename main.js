const BTC_API = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
const CANDLE_API = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=';
const FEAR_GREED_API = 'https://api.alternative.me/fng/?limit=1';
const AUTO_UPDATE_MS = 30000;

const state = {
  priceData: null,
  indicators: {},
  history: [],
  alerts: JSON.parse(localStorage.getItem('btcAlerts') || '[]'),
  darkMode: JSON.parse(localStorage.getItem('btcDarkMode') || 'true'),
  timeframe: '1h',
  forecast: {},
};

const refs = {
  price: document.getElementById('btc-price'),
  change: document.getElementById('btc-change'),
  volume: document.getElementById('btc-volume'),
  marketCap: document.getElementById('btc-marketcap'),
  rating: document.getElementById('market-rating'),
  analysis: document.getElementById('analysis-report'),
  recommendation: document.getElementById('analysis-action'),
  chartTimeButtons: Array.from(document.querySelectorAll('[data-timeframe]')),
  rsiValue: document.getElementById('rsi-value'),
  macdValue: document.getElementById('macd-value'),
  ema20Value: document.getElementById('ema20-value'),
  ema50Value: document.getElementById('ema50-value'),
  atrValue: document.getElementById('atr-value'),
  volumeValue: document.getElementById('volume-value'),
  fearGreed: document.getElementById('fear-greed'),
  fearLabel: document.getElementById('fear-label'),
  forecastList: document.getElementById('forecast-list'),
  alertList: document.getElementById('alert-list'),
  alertForm: document.getElementById('alert-form'),
  alertPrice: document.getElementById('alert-price'),
  alertType: document.getElementById('alert-type'),
  darkToggle: document.getElementById('dark-toggle'),
  alertButton: document.getElementById('alert-button'),
  liveUpdated: document.getElementById('live-updated'),
  historyList: document.getElementById('history-list'),
  analystGrade: document.getElementById('analyst-grade'),
  signalBox: document.getElementById('signal-box'),
  daytradeReport: document.getElementById('daytrade-report'),
  riskEngine: document.getElementById('risk-engine'),
  chartContainer: document.getElementById('chart'),
  volumeContainer: document.getElementById('volume-chart'),
  chartLegend: document.getElementById('chart-legend'),
};

function toNumber(value) {
  return Number(Number(value).toFixed(2));
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function formatLarge(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function getLabelColor(value, neutralRange = [40, 60]) {
  if (value >= neutralRange[1]) return 'green';
  if (value <= neutralRange[0]) return 'red';
  return 'yellow';
}

function renderStatusBadge(status) {
  if (status === 'strong-bull') return '<span class="label-pill label-bull">強烈看漲 🟢</span>';
  if (status === 'bull') return '<span class="label-pill label-bull">看漲 🟢</span>';
  if (status === 'neutral') return '<span class="label-pill label-neutral">中性 🟡</span>';
  if (status === 'bear') return '<span class="label-pill label-bear">看跌 🔴</span>';
  return '<span class="label-pill label-bear">強烈看跌 🔴</span>';
}

async function fetchTicker() {
  const response = await fetch(BTC_API);
  return response.json();
}

async function fetchCandleData(interval) {
  const response = await fetch(`${CANDLE_API}${interval}&limit=100`);
  return response.json();
}

async function fetchFearGreed() {
  const response = await fetch(FEAR_GREED_API);
  const json = await response.json();
  return json.data[0];
}

function calcEMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  return values.map((price, idx) => {
    ema = idx === 0 ? price : price * k + ema * (1 - k);
    return ema;
  });
}

function calcRSI(values, period = 14) {
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) gains += delta;
    else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsi = [];
  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) {
      avgGain = (avgGain * (period - 1) + delta) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - delta) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi.slice(-1)[0] || 50;
}

function calcMACD(values, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = calcEMA(values, fast);
  const emaSlow = calcEMA(values, slow);
  const macdLine = emaFast.map((v, idx) => v - emaSlow[idx]);
  const signalLine = calcEMA(macdLine.slice(slow - 1), signalPeriod);
  const histogram = macdLine.slice(slow - 1).map((v, idx) => v - signalLine[idx]);
  return {
    macd: macdLine.slice(-1)[0],
    signal: signalLine.slice(-1)[0],
    hist: histogram.slice(-1)[0],
  };
}

function calcATR(highs, lows, closes, period = 14) {
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const currentHigh = highs[i];
    const currentLow = lows[i];
    const prevClose = closes[i - 1];
    trs.push(Math.max(currentHigh - currentLow, Math.abs(currentHigh - prevClose), Math.abs(currentLow - prevClose)));
  }
  const atr = trs.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  return atr;
}

function analyzeMarket(indicators, latest) {
  const { rsi, macd, ema20, ema50, volume, atr } = indicators;
  const trendScore = (ema20 > ema50 ? 1 : -1) + (macd > 0 ? 1 : -1);
  const momentumScore = rsi > 70 ? -1 : rsi < 30 ? 1 : 0;
  const volumeScore = latest.volume > volume ? 1 : -1;
  const score = trendScore + momentumScore + volumeScore;
  let grade = 'neutral';
  let advice = '觀察市場動態，等待更明確的趨勢訊號。';
  if (score >= 2) {
    grade = 'strong-bull';
    advice = 'EMA20 在 EMA50 之上，MACD 正向且成交量穩定，多頭趨勢較強，建議分批買入並設定停損。';
  } else if (score === 1) {
    grade = 'bull';
    advice = '短期趨勢偏多，若 RSI 未過熱，可考慮小額進場或追蹤震盪。';
  } else if (score === 0) {
    grade = 'neutral';
    advice = '指標交錯，市場處於整理期，建議保守觀望並等待確認。';
  } else if (score === -1) {
    grade = 'bear';
    advice = '趨勢偏空且成交量減弱，可能出現回檔，建議觀望或分批獲利了結。';
  } else {
    grade = 'strong-bear';
    advice = 'MACD 轉弱且 EMA20 低於 EMA50，短線存在下跌風險，建議減倉並關注關鍵支撐。';
  }
  return { grade, advice };
}

function getMarketMood(score) {
  if (score >= 80) return { label: '極度貪婪', color: 'green' };
  if (score >= 60) return { label: '貪婪', color: 'green' };
  if (score >= 40) return { label: '中性', color: 'yellow' };
  if (score >= 20) return { label: '恐懼', color: 'yellow' };
  return { label: '極度恐懼', color: 'red' };
}

function analyzeDayTrading(indicators, price, direction) {
  const { rsi, macd, ema20, ema50, atr } = indicators;
  const trendUp = ema20 > ema50;
  const momentum = macd > 0;
  const volumeSignal = direction > 0 ? '資金流入加速' : '資金動能偏弱';
  const volatilityLabel = atr > price * 0.01 ? '波動較高，風險管理需嚴格' : '波動溫和，選擇機會較清晰';
  let signal = '中性觀察';
  let detail = '當前日內動態尚未形成明確單邊趨勢，建議等待 5 分鐘級別突破或回檔位。';

  if (trendUp && momentum && rsi < 70 && direction > 0) {
    signal = '日內多頭優勢';
    detail = `短線價量配合，多頭趨勢仍在，${volumeSignal}，${volatilityLabel}。可尋找回撤買點並嚴設風險。`;
  } else if (!trendUp && !momentum && rsi > 30 && direction < 0) {
    signal = '日內空頭壓力';
    detail = `短線趨勢偏弱，${volumeSignal}，${volatilityLabel}。建議觀察反彈後的阻力與分批減倉。`;
  } else if (rsi > 75) {
    signal = '超買回檔警戒';
    detail = `RSI 進入超買區，短線可能回檔，注意風險控制與停利。`;
  } else if (rsi < 25) {
    signal = '超賣反彈機會';
    detail = `RSI 進入超賣區，若價格接近支撐可留意反彈，採取小倉位。`;
  }

  return { signal, detail };
}

function createForecastRow(label, probability, range) {
  return `<li class="signal-item"><strong>${label}</strong><small>上漲機率: ${probability.up}% / 下跌機率: ${probability.down}%</small><small>預估區間: ${range}</small></li>`;
}

function computeForecast(price, indicators) {
  const { rsi, macd, ema20, ema50, atr } = indicators;
  const momentum = macd > 0 ? 0.55 : 0.45;
  const trend = ema20 > ema50 ? 0.55 : 0.45;
  const volBias = rsi < 50 ? 0.52 : 0.48;
  const baseUp = Math.round((momentum + trend + volBias) / 3 * 100);
  const up = Math.min(90, Math.max(10, baseUp));
  const down = 100 - up;
  const volatility = atr / price;
  const rangeFactor = Math.max(0.008, Math.min(0.03, volatility));
  const low = formatPrice(price * (1 - rangeFactor));
  const high = formatPrice(price * (1 + rangeFactor));
  return { up, down, range: `${low} ~ ${high}` };
}

async function refreshData() {
  try {
    const ticker = await fetchTicker();
    const fearData = await fetchFearGreed();
    const candleData = await fetchCandleData(state.timeframe);
    const closePrices = candleData.map(c => Number(c[4]));
    const highs = candleData.map(c => Number(c[2]));
    const lows = candleData.map(c => Number(c[3]));
    const volumeSeries = candleData.map(c => Number(c[5]));

    const ema20 = calcEMA(closePrices, 20).slice(-1)[0];
    const ema50 = calcEMA(closePrices, 50).slice(-1)[0];
    const rsi = calcRSI(closePrices);
    const macd = calcMACD(closePrices);
    const atr = calcATR(highs, lows, closePrices);

    state.priceData = ticker;
    state.indicators = {
      rsi: toNumber(rsi),
      macd: toNumber(macd.macd),
      ema20: toNumber(ema20),
      ema50: toNumber(ema50),
      atr: toNumber(atr),
      volume: toNumber(volumeSeries.slice(-20).reduce((a,b)=>a+b,0)/20),
    };
    state.forecast = computeForecast(Number(ticker.lastPrice), state.indicators);
    state.fearGreed = getMarketMood(Number(fearData.value));

    updateUI(ticker, fearData);
    saveHistory({ ticker, indicators: state.indicators, forecast: state.forecast, time: new Date().toISOString() });
    renderAlerts(ticker);
    checkAlerts(ticker);
  } catch (error) {
    console.error('更新資料失敗：', error);
  }
}

function updateUI(ticker, fearData) {
  refs.price.innerHTML = formatPrice(Number(ticker.lastPrice));
  refs.change.innerHTML = `${toNumber(ticker.priceChangePercent)}%`;
  refs.volume.innerHTML = `${formatLarge(Number(ticker.volume))} BTC`;
  refs.marketCap.innerHTML = `~${formatPrice(Number(ticker.lastPrice) * 19000000)}`;
  refs.rating.innerHTML = renderStatusBadge(analyzeMarket(state.indicators, { volume: Number(ticker.volume) }).grade);
  const signal = analyzeMarket(state.indicators, { volume: Number(ticker.volume) });
  refs.analysis.innerHTML = `${signal.advice}`;
  refs.recommendation.innerHTML = signal.grade === 'strong-bull' ? '建議買入' : signal.grade === 'bull' ? '觀望' : signal.grade === 'neutral' ? '觀望' : signal.grade === 'bear' ? '分批獲利了結' : '建議減倉';

  refs.rsiValue.innerHTML = `${state.indicators.rsi}`;
  refs.macdValue.innerHTML = `${state.indicators.macd}`;
  refs.ema20Value.innerHTML = `${state.indicators.ema20}`;
  refs.ema50Value.innerHTML = `${state.indicators.ema50}`;
  refs.atrValue.innerHTML = `${state.indicators.atr}`;
  refs.volumeValue.innerHTML = `${formatLarge(Number(ticker.volume))} BTC`;

  refs.fearGreed.innerHTML = `${fearData.value}`;
  refs.fearLabel.innerHTML = `${getMarketMood(Number(fearData.value)).label}`;
  refs.forecastList.innerHTML = '';
  refs.forecastList.insertAdjacentHTML('beforeend', createForecastRow('1 小時預測', { up: state.forecast.up, down: state.forecast.down }, state.forecast.range));
  refs.forecastList.insertAdjacentHTML('beforeend', createForecastRow('4 小時預測', { up: Math.max(50, state.forecast.up - 4), down: Math.min(50, state.forecast.down + 4) }, state.forecast.range));
  refs.forecastList.insertAdjacentHTML('beforeend', createForecastRow('24 小時預測', { up: Math.max(40, state.forecast.up - 8), down: Math.min(60, state.forecast.down + 8) }, state.forecast.range));

  refs.analystGrade.innerHTML = renderStatusBadge(signal.grade);
  refs.signalBox.innerHTML = `<p>${signal.advice}</p>`;
  const liveDirection = Number(ticker.lastPrice) - Number(ticker.prevClose || ticker.lastPrice);
  const dayTrade = analyzeDayTrading(state.indicators, Number(ticker.lastPrice), liveDirection);
  refs.daytradeReport.innerHTML = `<strong>${dayTrade.signal}</strong><br>${dayTrade.detail}`;
  refs.riskEngine.innerHTML = `<p>ATR ${state.indicators.atr} 表示短期波動。<br>EMA20/EMA50 趨勢：${state.indicators.ema20 > state.indicators.ema50 ? '多頭延續' : '空頭壓力'}。<br>成交量趨勢：${Number(ticker.volume) > state.indicators.volume ? '加碼成交' : '流動性縮減'}。</p>`;

  refs.liveUpdated.innerText = `更新時間：${new Date().toLocaleTimeString()}`;
  updateIndicatorStyles();
  renderHistory();
}

function updateIndicatorStyles() {
  refs.rsiValue.parentElement.className = `indicator-card ${getLabelColor(state.indicators.rsi) === 'green' ? 'label-bull' : getLabelColor(state.indicators.rsi) === 'red' ? 'label-bear' : 'label-neutral'}`;
  refs.macdValue.parentElement.className = `indicator-card ${state.indicators.macd > 0 ? 'label-bull' : state.indicators.macd < 0 ? 'label-bear' : 'label-neutral'}`;
  refs.ema20Value.parentElement.className = `indicator-card ${state.indicators.ema20 > state.indicators.ema50 ? 'label-bull' : 'label-bear'}`;
  refs.ema50Value.parentElement.className = `indicator-card ${state.indicators.ema20 > state.indicators.ema50 ? 'label-bull' : 'label-bear'}`;
  refs.atrValue.parentElement.className = `indicator-card ${state.indicators.atr > 60 ? 'label-bear' : state.indicators.atr > 30 ? 'label-neutral' : 'label-bull'}`;
  refs.volumeValue.parentElement.className = `indicator-card ${Number(state.priceData.volume) > state.indicators.volume ? 'label-bull' : 'label-bear'}`;
}

function renderHistory() {
  const data = JSON.parse(localStorage.getItem('btcHistory') || '[]');
  refs.historyList.innerHTML = data.slice(-5).reverse().map(item => `
    <li class="history-item">
      <strong>${new Date(item.time).toLocaleString()}</strong>
      <small>價格: ${formatPrice(Number(item.ticker.lastPrice))} / RSI: ${item.indicators.rsi} / MACD: ${item.indicators.macd}</small>
      <small>${item.forecast.range}</small>
    </li>`).join('');
}

function saveHistory(entry) {
  const history = JSON.parse(localStorage.getItem('btcHistory') || '[]');
  history.push(entry);
  localStorage.setItem('btcHistory', JSON.stringify(history.slice(-50)));
}

function renderAlerts(ticker) {
  refs.alertList.innerHTML = state.alerts.map((alert, index) => `
    <li class="alert-item">
      <strong>${alert.type === 'above' ? '價格高於' : '價格低於'} ${formatPrice(alert.price)}</strong>
      <small>目前價格：${formatPrice(Number(ticker.lastPrice))}</small>
      <button onclick="removeAlert(${index})">刪除</button>
    </li>`).join('');
}

window.removeAlert = function(index) {
  state.alerts.splice(index, 1);
  localStorage.setItem('btcAlerts', JSON.stringify(state.alerts));
  renderAlerts(state.priceData);
};

function setupChart() {
  // main chart
  const mainChart = LightweightCharts.createChart(refs.chartContainer, {
    width: refs.chartContainer.clientWidth,
    height: 320,
    layout: {
      background: { color: 'rgba(2,6,23,0.72)' },
      textColor: '#cbd5e1',
    },
    grid: {
      vertLines: { color: 'rgba(148,163,184,0.08)' },
      horzLines: { color: 'rgba(148,163,184,0.08)' },
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: 'rgba(148,163,184,0.12)' },
    timeScale: { borderColor: 'rgba(148,163,184,0.12)' },
  });
  const candleSeries = mainChart.addCandlestickSeries({
    upColor: '#22c55e',
    downColor: '#fb7185',
    borderDownColor: '#fb7185',
    borderUpColor: '#22c55e',
    wickDownColor: '#fca5a5',
    wickUpColor: '#86efac',
  });
  const ema20Series = mainChart.addLineSeries({ color: '#f59e0b', lineWidth: 1 });
  const ema50Series = mainChart.addLineSeries({ color: '#60a5fa', lineWidth: 1 });

  // volume chart (separate pane) with synced time scale
  const volumeChart = LightweightCharts.createChart(refs.volumeContainer, {
    width: refs.volumeContainer.clientWidth,
    height: 120,
    layout: { background: { color: 'transparent' }, textColor: '#cbd5e1' },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    rightPriceScale: { visible: false },
    timeScale: { visible: true, borderColor: 'rgba(148,163,184,0.08)' },
  });
  const volumeSeries = volumeChart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    scaleMargins: { top: 0.1, bottom: 0 },
    color: '#2b6f37',
  });

  // sync visible range both ways
  mainChart.timeScale().subscribeVisibleTimeRangeChange(range => {
    if (range && volumeChart) volumeChart.timeScale().setVisibleRange(range);
  });
  volumeChart.timeScale().subscribeVisibleTimeRangeChange(range => {
    if (range && mainChart) mainChart.timeScale().setVisibleRange(range);
  });

  state.chart = { chart: mainChart, candleSeries, volumeChart, volumeSeries, ema20Series, ema50Series };
  return mainChart;
}

function setupLegendControls() {
  const e20 = document.getElementById('toggle-ema20');
  const e50 = document.getElementById('toggle-ema50');
  if (e20) e20.addEventListener('change', (ev) => {
    const show = ev.target.checked;
    if (!state.latestEMAs) return;
    if (show) state.chart.ema20Series.setData(state.latestEMAs.ema20 || []);
    else state.chart.ema20Series.setData([]);
  });
  if (e50) e50.addEventListener('change', (ev) => {
    const show = ev.target.checked;
    if (!state.latestEMAs) return;
    if (show) state.chart.ema50Series.setData(state.latestEMAs.ema50 || []);
    else state.chart.ema50Series.setData([]);
  });
}

async function loadChartData(timeframe) {
  try {
    const candleData = await fetchCandleData(timeframe);
    const formatted = candleData.map(c => ({
      time: Math.floor(c[0] / 1000),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
    }));

    if (!state.chart || !state.chart.candleSeries) return;
    if (!formatted.length) {
      console.warn('K 線資料為空，請檢查 API 回傳');
      return;
    }

    // prepare volume and EMA series
    const volumeData = candleData.map(c => ({
      time: Math.floor(c[0] / 1000),
      value: Number(c[5]),
      color: Number(c[4]) >= Number(c[1]) ? '#22c55e' : '#fb7185',
    }));

    const closePrices = candleData.map(c => Number(c[4]));
    const ema20 = calcEMA(closePrices, 20);
    const ema50 = calcEMA(closePrices, 50);
    const ema20Data = ema20.map((v, i) => ({ time: Math.floor(candleData[i][0] / 1000), value: Number(v) }));
    const ema50Data = ema50.map((v, i) => ({ time: Math.floor(candleData[i][0] / 1000), value: Number(v) }));

    state.chart.candleSeries.setData(formatted);
    if (state.chart.volumeSeries) state.chart.volumeSeries.setData(volumeData);
    if (state.chart.ema20Series) state.chart.ema20Series.setData(ema20Data);
    if (state.chart.ema50Series) state.chart.ema50Series.setData(ema50Data);

    // store for websocket updates
    state.latestCandles = { candles: formatted, volumes: volumeData };

    // update legend
    const lastEma20 = ema20Data.slice(-1)[0];
    const lastEma50 = ema50Data.slice(-1)[0];
    if (refs.chartLegend) {
      refs.chartLegend.innerHTML = `
        <div class="legend-item"><span class="legend-swatch" style="background:#f59e0b"></span>EMA20: ${lastEma20 ? toNumber(lastEma20.value) : '-'} </div>
        <div class="legend-item"><span class="legend-swatch" style="background:#60a5fa"></span>EMA50: ${lastEma50 ? toNumber(lastEma50.value) : '-'} </div>`;
    }

    // fit both charts
    try { state.chart.chart.timeScale().fitContent(); } catch (e) {}
    try { state.chart.volumeChart.timeScale().fitContent(); } catch (e) {}
  } catch (error) {
    console.error('載入 K 線資料失敗：', error);
  }
}

function connectKlineSocket(interval) {
  // close existing kline socket if any
  if (state.klineSocket) {
    try { state.klineSocket.close(); } catch (e) {}
    state.klineSocket = null;
  }
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`);
  ws.addEventListener('message', event => {
    const payload = JSON.parse(event.data);
    const k = payload.k;
    if (!k) return;
    const point = {
      time: Math.floor(k.t / 1000),
      open: Number(k.o),
      high: Number(k.h),
      low: Number(k.l),
      close: Number(k.c),
    };
    const volPoint = { time: Math.floor(k.t / 1000), value: Number(k.v), color: Number(k.c) >= Number(k.o) ? '#22c55e' : '#fb7185' };

    // update series (update will append/replace correctly)
    try { state.chart.candleSeries.update(point); } catch (e) {}
    try { state.chart.volumeSeries.update(volPoint); } catch (e) {}

    // update stored candles
    if (state.latestCandles && Array.isArray(state.latestCandles.candles)) {
      const last = state.latestCandles.candles[state.latestCandles.candles.length - 1];
      if (last && last.time === point.time) {
        state.latestCandles.candles[state.latestCandles.candles.length - 1] = point;
        state.latestCandles.volumes[state.latestCandles.volumes.length - 1] = volPoint;
      } else {
        state.latestCandles.candles.push(point);
        state.latestCandles.volumes.push(volPoint);
        if (state.latestCandles.candles.length > 200) state.latestCandles.candles.shift(), state.latestCandles.volumes.shift();
      }
      // recompute EMAs and update lines
      const closes = state.latestCandles.candles.map(c => Number(c.close));
      const ema20 = calcEMA(closes, 20).map((v, i) => ({ time: state.latestCandles.candles[i].time, value: Number(v) }));
      const ema50 = calcEMA(closes, 50).map((v, i) => ({ time: state.latestCandles.candles[i].time, value: Number(v) }));
      try { state.chart.ema20Series.setData(ema20); } catch (e) {}
      try { state.chart.ema50Series.setData(ema50); } catch (e) {}

      // update legend values
      const lastEma20 = ema20.slice(-1)[0];
      const lastEma50 = ema50.slice(-1)[0];
      if (refs.chartLegend) {
        refs.chartLegend.innerHTML = `
          <div class="legend-item"><span class="legend-swatch" style="background:#f59e0b"></span>EMA20: ${lastEma20 ? toNumber(lastEma20.value) : '-'} </div>
          <div class="legend-item"><span class="legend-swatch" style="background:#60a5fa"></span>EMA50: ${lastEma50 ? toNumber(lastEma50.value) : '-'} </div>`;
      }
    }
  });
  ws.addEventListener('close', () => setTimeout(() => connectKlineSocket(interval), 2000));
  ws.addEventListener('error', () => ws.close());
  state.klineSocket = ws;
}

// volume tooltip handling
function setupVolumeTooltip() {
  const tooltip = document.getElementById('volume-tooltip');
  if (!tooltip || !state.chart || !state.chart.volumeChart) return;
  state.chart.volumeChart.subscribeCrosshairMove(param => {
    if (!param || !param.time) { tooltip.style.display = 'none'; return; }
    const x = param.domPosition.x + refs.volumeContainer.getBoundingClientRect().left + window.scrollX;
    const y = refs.volumeContainer.getBoundingClientRect().top + window.scrollY + 8;
    const seriesPrices = param.seriesPrices;
    const volVal = seriesPrices ? Object.values(seriesPrices)[0] : null;
    if (volVal == null) { tooltip.style.display = 'none'; return; }
    tooltip.style.display = 'block';
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.innerText = `成交量: ${formatLarge(volVal)} BTC`;
  });
}

function updateTimeframe(event) {
  state.timeframe = event.target.dataset.timeframe;
  refs.chartTimeButtons.forEach(btn => btn.classList.toggle('active', btn === event.target));
  loadChartData(state.timeframe);
  connectKlineSocket(state.timeframe);
  refreshData();
}

function saveDarkMode(value) {
  state.darkMode = value;
  localStorage.setItem('btcDarkMode', JSON.stringify(value));
  document.documentElement.style.colorScheme = value ? 'dark' : 'light';
  document.body.classList.toggle('light-mode', !value);
  refs.darkToggle.textContent = value ? '深色模式' : '淺色模式';
}

function setupAlerts() {
  refs.alertForm.addEventListener('submit', event => {
    event.preventDefault();
    const price = Number(refs.alertPrice.value);
    const type = refs.alertType.value;
    if (!price || price <= 0) return;
    state.alerts.push({ price, type });
    localStorage.setItem('btcAlerts', JSON.stringify(state.alerts));
    refs.alertPrice.value = '';
    renderAlerts(state.priceData);
  });
}

function checkAlerts(ticker) {
  state.alerts.forEach(alert => {
    const price = Number(ticker.lastPrice);
    if ((alert.type === 'above' && price >= alert.price) || (alert.type === 'below' && price <= alert.price)) {
      alert.triggered = true;
      alert.notified = true;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('BTC 價格警報', { body: `價格已 ${alert.type === 'above' ? '高於' : '低於'} ${formatPrice(alert.price)}。` });
      }
    }
  });
}

function askNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function connectLivePriceSocket() {
  const stream = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
  stream.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    const price = Number(data.p);
    if (!Number.isFinite(price)) return;
    state.priceData = { ...state.priceData, lastPrice: price.toString(), prevClose: state.priceData?.lastPrice };
    refs.price.innerHTML = formatPrice(price);
    refs.liveUpdated.innerText = `實時更新：${new Date(data.T).toLocaleTimeString()}`;
    if (state.priceData) {
      const lastPrice = Number(state.priceData.lastPrice);
      const prevClose = Number(state.priceData.prevClose || lastPrice);
      refs.change.innerHTML = `${toNumber((lastPrice - prevClose) / prevClose * 100)}%`;
    }
  });
  stream.addEventListener('close', () => setTimeout(connectLivePriceSocket, 3000));
  stream.addEventListener('error', () => stream.close());
  state.socket = stream;
}

// simple tick -> 1m aggregation
function aggregateTradeTickToMinute(trade) {
  if (!state.chart || !state.chart.candleSeries) return;
  const t = trade.T; // trade time in ms
  const minute = Math.floor(t / 60000) * 60; // seconds
  const price = Number(trade.p);
  const qty = Number(trade.q || trade.l || 0);
  if (!state.tickAgg) state.tickAgg = { minute: minute, bar: null };
  if (!state.tickAgg.bar || state.tickAgg.minute !== minute) {
    // new bar
    state.tickAgg.minute = minute;
    const open = price, high = price, low = price, close = price, volume = qty;
    state.tickAgg.bar = { time: minute, open, high, low, close };
    // append as new bar
    try { state.chart.candleSeries.update(state.tickAgg.bar); } catch (e) {}
    try { state.chart.volumeSeries.update({ time: minute, value: volume, color: '#22c55e' }); } catch (e) {}
  } else {
    // update existing
    const b = state.tickAgg.bar;
    b.high = Math.max(b.high, price);
    b.low = Math.min(b.low, price);
    b.close = price;
    try { state.chart.candleSeries.update(b); } catch (e) {}
    try { state.chart.volumeSeries.update({ time: minute, value: (state.tickAgg.vol || 0) + qty, color: price >= b.open ? '#22c55e' : '#fb7185' }); } catch (e) {}
    state.tickAgg.vol = (state.tickAgg.vol || 0) + qty;
  }
}

function init() {
  setupChart();
  refs.chartTimeButtons.forEach(btn => btn.addEventListener('click', updateTimeframe));
  refs.chartTimeButtons.find(btn => btn.dataset.timeframe === state.timeframe).classList.add('active');
  refs.darkToggle.addEventListener('click', () => saveDarkMode(!state.darkMode));
  refs.alertButton.addEventListener('click', () => {
    document.getElementById('alert-price').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  saveDarkMode(state.darkMode);
  setupAlerts();
  askNotificationPermission();
  connectLivePriceSocket();
  refreshData();
  loadChartData(state.timeframe);
  connectKlineSocket(state.timeframe);
  setupLegendControls();
  setupVolumeTooltip();
  setInterval(refreshData, AUTO_UPDATE_MS);
  window.addEventListener('resize', () => {
    if (state.chart && state.chart.chart) {
      state.chart.chart.applyOptions({ width: refs.chartContainer.clientWidth });
      if (state.chart.volumeChart) state.chart.volumeChart.applyOptions({ width: refs.volumeContainer.clientWidth });
    }
  });
}

init();
