document.addEventListener('DOMContentLoaded', () => {
    const langSelect = document.getElementById('lang-select');
    const uploadInput = document.getElementById('upload-input');
    const previewImg = document.getElementById('preview-img');
    const predictBtn = document.getElementById('predict-btn');
    const resultArea = document.getElementById('result-area');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatWindow = document.getElementById('chat-window');
    const cameraBtn = document.getElementById('camera-btn');
    const cameraView = document.getElementById('camera-view');
    const photoCanvas = document.getElementById('photo-canvas');
    let stream = null;
    
    // Language Switcher
    if (langSelect) {
        langSelect.addEventListener('change', async (e) => {
            const lang = e.target.value;
            await fetch('/set_language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lang })
            });
            window.location.reload();
        });
    }

    // Image Upload & Preview
    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                stopCamera();
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewImg.style.display = 'block';
                    cameraView.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Camera Capture
    if (cameraBtn) {
        cameraBtn.addEventListener('click', async () => {
            if (stream) {
                // Take photo
                photoCanvas.width = cameraView.videoWidth;
                photoCanvas.height = cameraView.videoHeight;
                photoCanvas.getContext('2d').drawImage(cameraView, 0, 0);
                previewImg.src = photoCanvas.toDataURL('image/jpeg');
                previewImg.style.display = 'block';
                stopCamera();
                
                // Convert to file for uploadInput
                const blob = await new Promise(resolve => photoCanvas.toBlob(resolve, 'image/jpeg'));
                const file = new File([blob], "camera_photo.jpg", { type: "image/jpeg" });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                uploadInput.files = dataTransfer.files;
            } else {
                // Start camera
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                    cameraView.srcObject = stream;
                    cameraView.play();
                    cameraView.style.display = 'block';
                    previewImg.style.display = 'none';
                    cameraBtn.querySelector('p').innerText = translations['capture_photo'] || 'Capture Photo';
                } catch (err) {
                    alert("Camera access denied or not available.");
                }
            }
        });
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            cameraView.style.display = 'none';
            if (cameraBtn) cameraBtn.querySelector('p').innerText = translations['take_photo'] || 'Take Photo';
        }
    }

    // Predict Disease
    if (predictBtn) {
        predictBtn.addEventListener('click', async () => {
            const file = uploadInput.files[0];
            if (!file) {
                alert('Please upload an image first.');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            predictBtn.disabled = true;
            predictBtn.innerText = translations['analyzing'] || 'Analyzing...';
            resultArea.style.display = 'none';

            try {
                const response = await fetch('/predict', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.status === 'success') {
                    resultArea.innerHTML = `
                        <div class="result-card success">
                            <h3>✅ ${data.display_name}</h3>
                            <p><strong>${translations['confidence'] || 'Confidence'}:</strong> ${data.confidence}</p>
                            <div style="margin-top: 1rem; text-align: left;">
                                <h4>${translations['solution_info'] || 'Solution Info'}:</h4>
                                <div class="solution-text">${data.solution.replace(/\n/g, '<br>')}</div>
                            </div>
                            <div style="margin-top: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                                <a href="/generate_report" class="btn btn-primary" target="_blank">📄 ${translations['download_report'] || 'Download Report'}</a>
                                <button class="btn btn-secondary" onclick="findNearShops()">🌿 ${translations['find_shops'] || 'Find Nearby Shops'}</button>
                            </div>
                        </div>
                    `;
                    resultArea.style.display = 'block';
                } else if (data.status === 'low_confidence') {
                    resultArea.innerHTML = `<div class="result-card warning">⚠️ ${data.solution}</div>`;
                    resultArea.style.display = 'block';
                } else if (data.status === 'invalid_image') {
                    resultArea.innerHTML = `<div class="result-card error">❌ ${data.solution}</div>`;
                    resultArea.style.display = 'block';
                } else {
                    alert(data.error || 'Prediction failed');
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred during analysis.');
            } finally {
                predictBtn.disabled = false;
                predictBtn.innerText = translations['analyze_leaf'] || 'Analyze Leaf';
            }
        });
    }

    // AI Chat
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        appendMessage('user', message);
        chatInput.value = '';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            const data = await response.json();
            if (data.response) {
                appendMessage('bot', data.response);
            } else {
                appendMessage('bot', 'Sorry, I encountered an error.');
            }
        } catch (err) {
            console.error(err);
            appendMessage('bot', 'Network error. Please try again.');
        }
    }

    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
        msgDiv.innerText = text;
        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Find Nearby Shops Logic
    window.findNearShops = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const url = `https://www.google.com/maps/search/pesticide+shop/@${lat},${lon},14z`;
                window.open(url, '_blank');
            }, () => {
                alert('Location access denied. Opening general map.');
                window.open('https://www.google.com/maps/search/pesticide+shop/', '_blank');
            });
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    };
});
