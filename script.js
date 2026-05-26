const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');
const expressionElement = document.getElementById('expression');
const startButton = document.getElementById('start-camera');
const stopButton = document.getElementById('stop-camera');
const switchButton = document.getElementById('switch-camera');
const uploadFile = document.getElementById('upload-file');

let camera = null;
let currentFacing = 'environment';
let lastSpoken = '';
let lastExpression = '';
let isCameraActive = false;

const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
faceMesh.onResults(onResults);

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
switchButton.addEventListener('click', switchCamera);
uploadFile.addEventListener('change', handleUpload);

function startCamera() {
  stopCamera();
  isCameraActive = true;
  statusElement.textContent = '正在啟動相機，請稍候...';
  switchButton.disabled = false;
  stopButton.disabled = false;
  startButton.disabled = true;

  camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480,
    facingMode: currentFacing,
  });

  camera.start().catch((error) => {
    console.error(error);
    statusElement.textContent = '無法啟動相機，請確認瀏覽器權限已開啟。';
    startButton.disabled = false;
    stopButton.disabled = true;
    switchButton.disabled = true;
  });
}

function stopCamera() {
  if (camera) {
    camera.stop();
    camera = null;
  }
  isCameraActive = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  switchButton.disabled = true;
  statusElement.textContent = '相機已停止。你可以重新按「開始相機」或上傳圖片/影片。';
}

function switchCamera() {
  currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
  if (isCameraActive) {
    startCamera();
  }
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  stopCamera();
  startButton.disabled = false;
  stopButton.disabled = true;
  switchButton.disabled = true;

  const url = URL.createObjectURL(file);
  if (file.type.startsWith('image/')) {
    processImage(url);
  } else if (file.type.startsWith('video/')) {
    processVideoFile(url);
  } else {
    statusElement.textContent = '不支援的檔案類型，請選擇圖片或影片。';
  }
}

async function processImage(url) {
  const image = new Image();
  image.src = url;
  image.onload = async () => {
    canvasElement.width = image.width;
    canvasElement.height = image.height;
    await faceMesh.send({ image });
    URL.revokeObjectURL(url);
  };
}

function processVideoFile(url) {
  videoElement.srcObject = null;
  videoElement.src = url;
  videoElement.muted = true;
  videoElement.play();
  videoElement.onloadeddata = () => {
    videoElement.play();
    const loop = async () => {
      if (videoElement.paused || videoElement.ended) return;
      await faceMesh.send({ image: videoElement });
      requestAnimationFrame(loop);
    };
    loop();
  };
}

function onResults(results) {
  canvasElement.width = videoElement.videoWidth || videoElement.width || 640;
  canvasElement.height = videoElement.videoHeight || videoElement.height || 480;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    for (const landmarks of results.multiFaceLandmarks) {
      drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: '#38bdf8', lineWidth: 1 });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#fb7185', lineWidth: 1 });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#fb7185', lineWidth: 1 });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#a78bfa', lineWidth: 2 });
    }
    const expression = detectExpression(results.multiFaceLandmarks[0]);
    updateUI(expression);
  } else {
    expressionElement.textContent = '目前表情：未偵測到人臉';
    statusElement.textContent = '請將臉部置於鏡頭前方，再次嘗試。';
  }

  canvasCtx.restore();
}

function detectExpression(landmarks) {
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const leftMouth = landmarks[61];
  const rightMouth = landmarks[291];
  const topLip = landmarks[13];
  const bottomLip = landmarks[14];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  const mouthWidth = distance(leftMouth, rightMouth);
  const mouthHeight = distance(topLip, bottomLip);
  const faceHeight = Math.max(distance(forehead, chin), 0.001);
  const normalizedMouthWidth = mouthWidth / faceHeight;
  const normalizedMouthHeight = mouthHeight / faceHeight;
  const smileRatio = normalizedMouthWidth / Math.max(normalizedMouthHeight, 0.001);

  if (smileRatio > 2.2 && normalizedMouthHeight < 0.14) {
    return '笑臉';
  }
  if (normalizedMouthHeight > 0.13) {
    return '驚訝';
  }
  return '自然';
}

function updateUI(expression) {
  if (expression === lastExpression) return;
  lastExpression = expression;

  let message = '';
  let status = '';
  switch (expression) {
    case '笑臉':
      message = '你今天看起來心情不錯喔！！';
      status = '偵測到笑臉，系統已回饋語音。';
      break;
    case '驚訝':
      message = '哇！你看起來很驚訝呢。';
      status = '偵測到驚訝表情，系統已回饋語音。';
      break;
    default:
      message = '你好像現在很平靜，繼續保持喔。';
      status = '偵測到自然表情。';
      break;
  }

  expressionElement.textContent = `目前表情：${expression}`;
  statusElement.textContent = status;
  speak(message);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  if (text === lastSpoken) return;
  lastSpoken = text;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
