// Initialize Telegram Web App
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    
    if (tg.requestFullscreen) tg.requestFullscreen();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#0a0a0f');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#a0a0a0');
}

// ============================================
// PSEUDO 3D CARD WITH TELEGRAM DEVICE MOTION
// ============================================

class Card3D {
    constructor(elementId) {
        this.card = document.getElementById(elementId);
        this.wrapper = this.card.parentElement;
        this.rotateX = 0;
        this.rotateY = 0;
        this.targetRotateX = 0;
        this.targetRotateY = 0;
        this.motionEnabled = false;
        this.isTouching = false;
        
        this.setupTouchTilt();
        this.setupMouse();
        this.initTelegramMotion();
        this.animate();
    }
    
    initTelegramMotion() {
        if (!tg) {
            console.log('No Telegram WebApp, falling back to native');
            this.fallbackToNativeGyro();
            return;
        }
        
        // Приоритет 1: Telegram DeviceOrientation API
        if (tg.DeviceOrientation) {
            console.log('Telegram DeviceOrientation available');
            this.startTelegramDeviceOrientation();
            return;
        }
        
        // Приоритет 2: Telegram Gyroscope API
        if (tg.Gyroscope) {
            console.log('Telegram Gyroscope available');
            this.startTelegramGyroscope();
            return;
        }
        
        console.log('Telegram Motion APIs not available, falling back');
        this.fallbackToNativeGyro();
    }
    
    startTelegramDeviceOrientation() {
        // Обработчики событий
        tg.onEvent('deviceOrientationStarted', () => {
            console.log('✅ DeviceOrientation started');
            this.motionEnabled = true;
            this.removeGyroButton();
        });
        
        tg.onEvent('deviceOrientationStopped', () => {
            console.log('⏹ DeviceOrientation stopped');
        });
        
        tg.onEvent('deviceOrientationFailed', (data) => {
            console.log('❌ DeviceOrientation failed:', data?.error);
            this.fallbackToNativeGyro();
        });
        
        tg.onEvent('deviceOrientationChanged', () => {
            if (this.isTouching) return;
            
            const orientation = tg.DeviceOrientation;
            if (orientation && orientation.absolute !== undefined) {
                // alpha: 0-360 (компас)
                // beta: -180 to 180 (наклон вперёд/назад)
                // gamma: -90 to 90 (наклон влево/вправо)
                const beta = orientation.beta || 0;
                const gamma = orientation.gamma || 0;
                
                this.targetRotateX = this.clamp(beta * 0.4, -30, 30);
                this.targetRotateY = this.clamp(gamma * 0.6, -30, 30);
                
                // Обновляем блик
                this.updateShine(
                    0.5 + gamma / 180,
                    0.5 + beta / 360
                );
            }
        });
        
        // Запускаем
        try {
            tg.DeviceOrientation.start({ refresh_rate: 60 });
        } catch (e) {
            console.error('DeviceOrientation start error:', e);
            this.fallbackToNativeGyro();
        }
    }
    
    startTelegramGyroscope() {
        tg.onEvent('gyroscopeStarted', () => {
            console.log('✅ Gyroscope started');
            this.motionEnabled = true;
            this.removeGyroButton();
        });
        
        tg.onEvent('gyroscopeStopped', () => {
            console.log('⏹ Gyroscope stopped');
        });
        
        tg.onEvent('gyroscopeFailed', (data) => {
            console.log('❌ Gyroscope failed:', data?.error);
            this.fallbackToNativeGyro();
        });
        
        tg.onEvent('gyroscopeChanged', () => {
            if (this.isTouching) return;
            
            const gyro = tg.Gyroscope;
            if (gyro) {
                // x, y, z - угловая скорость в рад/с
                this.targetRotateX += (gyro.y || 0) * 3;
                this.targetRotateY += (gyro.x || 0) * 3;
                
                this.targetRotateX = this.clamp(this.targetRotateX, -30, 30);
                this.targetRotateY = this.clamp(this.targetRotateY, -30, 30);
                
                // Медленное возвращение к центру
                this.targetRotateX *= 0.995;
                this.targetRotateY *= 0.995;
            }
        });
        
        try {
            tg.Gyroscope.start({ refresh_rate: 60 });
        } catch (e) {
            console.error('Gyroscope start error:', e);
            this.fallbackToNativeGyro();
        }
    }
    
    fallbackToNativeGyro() {
        console.log('Using native DeviceOrientation API');
        
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            this.createGyroButton();
        } else if ('DeviceOrientationEvent' in window) {
            this.bindNativeGyroscope();
        }
    }
    
    createGyroButton() {
        if (document.querySelector('.gyro-btn')) return;
        
        const btn = document.createElement('button');
        btn.className = 'gyro-btn';
        btn.innerHTML = '📱 Включить наклон';
        btn.onclick = async () => {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.bindNativeGyroscope();
                    btn.remove();
                }
            } catch (e) {
                console.error('Permission error:', e);
                btn.remove();
            }
        };
        document.querySelector('.app-container').appendChild(btn);
    }
    
    removeGyroButton() {
        const btn = document.querySelector('.gyro-btn');
        if (btn) btn.remove();
    }
    
    bindNativeGyroscope() {
        this.motionEnabled = true;
        window.addEventListener('deviceorientation', (e) => {
            if (this.isTouching) return;
            if (e.beta !== null && e.gamma !== null) {
                this.targetRotateX = this.clamp((e.beta - 45) * 0.4, -30, 30);
                this.targetRotateY = this.clamp(e.gamma * 0.6, -30, 30);
                this.updateShine(0.5 + e.gamma / 180, 0.5 + (e.beta - 45) / 180);
            }
        }, true);
    }
    
    setupTouchTilt() {
        this.wrapper.addEventListener('touchstart', () => {
            this.isTouching = true;
        }, { passive: true });
        
        this.wrapper.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const rect = this.wrapper.getBoundingClientRect();
                const x = (e.touches[0].clientX - rect.left) / rect.width;
                const y = (e.touches[0].clientY - rect.top) / rect.height;
                
                this.targetRotateY = (x - 0.5) * 50;
                this.targetRotateX = (0.5 - y) * 50;
                this.updateShine(x, y);
            }
        }, { passive: true });
        
        this.wrapper.addEventListener('touchend', () => {
            this.isTouching = false;
            if (!this.motionEnabled) {
                this.targetRotateX = 0;
                this.targetRotateY = 0;
                this.updateShine(0.5, 0.5);
            }
        });
    }
    
    setupMouse() {
        this.wrapper.addEventListener('mousemove', (e) => {
            const rect = this.wrapper.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            this.targetRotateY = (x - 0.5) * 40;
            this.targetRotateX = (0.5 - y) * 40;
            this.updateShine(x, y);
        });
        
        this.wrapper.addEventListener('mouseleave', () => {
            this.targetRotateX = 0;
            this.targetRotateY = 0;
            this.updateShine(0.5, 0.5);
        });
    }
    
    updateShine(x, y) {
        const cx = Math.max(0, Math.min(1, x));
        const cy = Math.max(0, Math.min(1, y));
        document.documentElement.style.setProperty('--mouse-x', `${cx * 100}%`);
        document.documentElement.style.setProperty('--mouse-y', `${cy * 100}%`);
    }
    
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    animate() {
        this.rotateX += (this.targetRotateX - this.rotateX) * 0.12;
        this.rotateY += (this.targetRotateY - this.rotateY) * 0.12;
        
        document.documentElement.style.setProperty('--card-rotate-x', `${this.rotateX}deg`);
        document.documentElement.style.setProperty('--card-rotate-y', `${this.rotateY}deg`);
        
        requestAnimationFrame(() => this.animate());
    }
    
    stop() {
        if (tg?.DeviceOrientation?.stop) tg.DeviceOrientation.stop();
        if (tg?.Gyroscope?.stop) tg.Gyroscope.stop();
    }
}

// ============================================
// SCRATCH CARD
// ============================================

class ScratchCard {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        this.options = {
            brushSize: options.brushSize || 40,
            revealThreshold: options.revealThreshold || 80,
            onProgress: options.onProgress || (() => {}),
            onReveal: options.onReveal || (() => {})
        };
        
        this.isDrawing = false;
        this.isRevealed = false;
        this.lastPoint = null;
        this.lastHapticTime = 0;
        
        setTimeout(() => this.init(), 100);
    }
    
    init() {
        this.setupCanvas();
        this.drawScratchLayer();
        this.bindEvents();
    }
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    
    drawScratchLayer() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#a0a0a0');
        gradient.addColorStop(0.3, '#d0d0d0');
        gradient.addColorStop(0.5, '#b8b8b8');
        gradient.addColorStop(0.7, '#c8c8c8');
        gradient.addColorStop(1, '#a8a8a8');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.font = 'bold 16px Unbounded, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#666';
        this.ctx.fillText('✨ СОТРИ МЕНЯ ✨', this.width / 2, this.height / 2);
    }
    
    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleEnd());
        this.canvas.addEventListener('mouseleave', () => this.handleEnd());
        
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleEnd());
    }
    
    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches?.[0];
        return {
            x: (touch?.clientX || e.clientX) - rect.left,
            y: (touch?.clientY || e.clientY) - rect.top
        };
    }
    
    handleStart(e) {
        if (this.isRevealed) return;
        e.preventDefault();
        this.isDrawing = true;
        this.lastPoint = this.getPos(e);
        
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }
    
    handleMove(e) {
        if (!this.isDrawing || this.isRevealed) return;
        e.preventDefault();
        
        const pos = this.getPos(e);
        this.scratch(this.lastPoint, pos);
        this.lastPoint = pos;
        
        const now = Date.now();
        if (now - this.lastHapticTime > 50) {
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            this.lastHapticTime = now;
        }
        
        this.checkProgress();
    }
    
    handleEnd() {
        this.isDrawing = false;
        this.lastPoint = null;
    }
    
    scratch(from, to) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.lineWidth = this.options.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(to.x, to.y, this.options.brushSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    checkProgress() {
        const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        let transparent = 0;
        
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 128) transparent++;
        }
        
        const percentage = Math.round((transparent / (data.length / 4)) * 100);
        this.options.onProgress(percentage);
        
        if (percentage >= this.options.revealThreshold && !this.isRevealed) {
            this.reveal();
        }
    }
    
    reveal() {
        this.isRevealed = true;
        
        this.canvas.style.transition = 'opacity 0.5s ease';
        this.canvas.style.opacity = '0';
        
        document.getElementById('card3d').classList.add('revealed');
        document.getElementById('content').classList.add('visible');
        
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        
        this.options.onReveal();
        
        setTimeout(() => {
            this.canvas.style.display = 'none';
        }, 500);
    }
}

// ============================================
// CONFETTI
// ============================================

function createConfetti() {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#43e97b', '#38f9d7', '#ffd700'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: ${6 + Math.random() * 6}px;
            height: ${6 + Math.random() * 6}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none;
            left: ${Math.random() * 100}vw;
            top: -20px;
            animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
            animation-delay: ${Math.random() * 0.5}s;
            z-index: 1000;
        `;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
    
    if (!document.getElementById('confetti-style')) {
        const style = document.createElement('style');
        style.id = 'confetti-style';
        style.textContent = `
            @keyframes confettiFall {
                0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const card3d = new Card3D('card3d');
    
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const hint = document.getElementById('hint');
    
    const scratch = new ScratchCard('scratch-canvas', {
        brushSize: 45,
        revealThreshold: 80,
        onProgress: (percent) => {
            progressFill.style.width = percent + '%';
            progressText.textContent = `Стёрто: ${percent}%`;
            if (percent > 5) hint.classList.add('hidden');
        },
        onReveal: () => {
            progressText.textContent = '🎉 Открыто!';
            progressFill.style.width = '100%';
            createConfetti();
        }
    });
    
    window.card3d = card3d;
    window.scratch = scratch;
});

function setGiftContent(html) {
    document.getElementById('content').innerHTML = html;
}
window.setGiftContent = setGiftContent;
