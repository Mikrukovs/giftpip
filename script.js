// Initialize Telegram Web App
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    
    if (tg.requestFullscreen) tg.requestFullscreen();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    
    // Apply all Telegram theme colors
    const tp = tg.themeParams;
    const root = document.documentElement.style;
    
    root.setProperty('--tg-theme-bg-color', tp.bg_color || '#0a0a0f');
    root.setProperty('--tg-theme-text-color', tp.text_color || '#ffffff');
    root.setProperty('--tg-theme-hint-color', tp.hint_color || '#a0a0a0');
    root.setProperty('--tg-theme-link-color', tp.link_color || '#5865f2');
    root.setProperty('--tg-theme-button-color', tp.button_color || '#5865f2');
    root.setProperty('--tg-theme-button-text-color', tp.button_text_color || '#ffffff');
    root.setProperty('--tg-theme-secondary-bg-color', tp.secondary_bg_color || '#1a1a2e');
    root.setProperty('--tg-theme-header-bg-color', tp.header_bg_color || '#0a0a0f');
    root.setProperty('--tg-theme-accent-text-color', tp.accent_text_color || '#5865f2');
    root.setProperty('--tg-theme-section-bg-color', tp.section_bg_color || '#1a1a2e');
    root.setProperty('--tg-theme-section-header-text-color', tp.section_header_text_color || '#a0a0a0');
    root.setProperty('--tg-theme-subtitle-text-color', tp.subtitle_text_color || '#a0a0a0');
    root.setProperty('--tg-theme-destructive-text-color', tp.destructive_text_color || '#ff5555');
    
    // Set body background
    document.body.style.backgroundColor = tp.bg_color || '#0a0a0f';
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
        
        // Калибровка — начальное положение телефона
        this.calibrated = false;
        this.baseBeta = 0;
        this.baseGamma = 0;
        
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
        
        console.log('Telegram WebApp version:', tg.version);
        console.log('DeviceOrientation:', tg.DeviceOrientation);
        console.log('Gyroscope:', tg.Gyroscope);
        
        // Сначала подписываемся на ВСЕ события
        this.setupTelegramEvents();
        
        // Затем пробуем запустить DeviceOrientation (приоритет)
        if (tg.DeviceOrientation && typeof tg.DeviceOrientation.start === 'function') {
            console.log('Starting Telegram DeviceOrientation...');
            tg.DeviceOrientation.start({ refresh_rate: 60 });
        }
        // Или Gyroscope
        else if (tg.Gyroscope && typeof tg.Gyroscope.start === 'function') {
            console.log('Starting Telegram Gyroscope...');
            tg.Gyroscope.start({ refresh_rate: 60 });
        }
        else {
            console.log('Telegram Motion APIs not available, falling back');
            this.fallbackToNativeGyro();
        }
    }
    
    setupTelegramEvents() {
        // DeviceOrientation events
        tg.onEvent('deviceOrientationStarted', () => {
            console.log('✅ deviceOrientationStarted');
            this.motionEnabled = true;
            this.removeGyroButton();
        });
        
        tg.onEvent('deviceOrientationStopped', () => {
            console.log('⏹ deviceOrientationStopped');
        });
        
        tg.onEvent('deviceOrientationFailed', (data) => {
            console.log('❌ deviceOrientationFailed:', data);
            // Пробуем Gyroscope как fallback
            if (tg.Gyroscope && typeof tg.Gyroscope.start === 'function') {
                console.log('Trying Gyroscope as fallback...');
                tg.Gyroscope.start({ refresh_rate: 60 });
            } else {
                this.fallbackToNativeGyro();
            }
        });
        
        tg.onEvent('deviceOrientationChanged', () => {
            const o = tg.DeviceOrientation;
            if (o) {
                // Данные приходят в РАДИАНАХ! Конвертируем в градусы
                const RAD_TO_DEG = 180 / Math.PI; // ≈ 57.3
                const beta = (o.beta || 0) * RAD_TO_DEG;
                const gamma = (o.gamma || 0) * RAD_TO_DEG;
                
                // Калибровка: запоминаем начальное положение
                if (!this.calibrated) {
                    this.baseBeta = beta;
                    this.baseGamma = gamma;
                    this.calibrated = true;
                    console.log('Calibrated at:', this.baseBeta.toFixed(1), this.baseGamma.toFixed(1));
                }
                
                // Вычисляем отклонение от начального положения
                const deltaBeta = beta - this.baseBeta;
                const deltaGamma = gamma - this.baseGamma;
                
                this.targetRotateX = this.clamp(-deltaBeta * 0.8, -25, 25);
                this.targetRotateY = this.clamp(deltaGamma * 1.0, -25, 25);
                
                this.applyTransform();
            }
        });
        
        // Gyroscope events
        tg.onEvent('gyroscopeStarted', () => {
            console.log('✅ gyroscopeStarted');
            this.motionEnabled = true;
            this.removeGyroButton();
        });
        
        tg.onEvent('gyroscopeStopped', () => {
            console.log('⏹ gyroscopeStopped');
        });
        
        tg.onEvent('gyroscopeFailed', (data) => {
            console.log('❌ gyroscopeFailed:', data);
            this.fallbackToNativeGyro();
        });
        
        tg.onEvent('gyroscopeChanged', () => {
            const g = tg.Gyroscope;
            if (g) {
                // Накапливаем вращение
                this.targetRotateX += (g.y || 0) * 3;
                this.targetRotateY += (g.x || 0) * 3;
                this.targetRotateX = this.clamp(this.targetRotateX, -30, 30);
                this.targetRotateY = this.clamp(this.targetRotateY, -30, 30);
                this.targetRotateX *= 0.995;
                this.targetRotateY *= 0.995;
            }
        });
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
            if (e.beta !== null && e.gamma !== null) {
                const beta = e.beta;
                const gamma = e.gamma;
                
                // Калибровка
                if (!this.calibrated) {
                    this.baseBeta = beta;
                    this.baseGamma = gamma;
                    this.calibrated = true;
                }
                
                const deltaBeta = beta - this.baseBeta;
                const deltaGamma = gamma - this.baseGamma;
                
                this.targetRotateX = this.clamp(-deltaBeta * 0.8, -25, 25);
                this.targetRotateY = this.clamp(deltaGamma * 1.0, -25, 25);
            }
        }, true);
    }
    
    setupTouchTilt() {
        // На мобильных устройствах отключаем tilt по тапу
        // Карточка наклоняется только от гироскопа
    }
    
    setupMouse() {
        this.wrapper.addEventListener('mousemove', (e) => {
            const rect = this.wrapper.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            this.targetRotateY = (x - 0.5) * 40;
            this.targetRotateX = (0.5 - y) * 40;
        });
        
        this.wrapper.addEventListener('mouseleave', () => {
            this.targetRotateX = 0;
            this.targetRotateY = 0;
        });
    }
    
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    applyTransform() {
        // Плавная интерполяция
        this.rotateX += (this.targetRotateX - this.rotateX) * 0.15;
        this.rotateY += (this.targetRotateY - this.rotateY) * 0.15;
        
        // Применяем трансформацию напрямую к карточке
        if (this.card) {
            this.card.style.transform = `rotateX(${this.rotateX}deg) rotateY(${this.rotateY}deg)`;
            
            // Update shimmer position for pattern
            // Convert rotation to shine position (inverted for natural light reflection)
            const shineX = 50 + this.rotateY * 1.5; // -25..25 -> 12.5..87.5
            const shineY = 50 - this.rotateX * 1.5;
            document.documentElement.style.setProperty('--shine-x', `${shineX}%`);
            document.documentElement.style.setProperty('--shine-y', `${shineY}%`);
        }
    }
    
    animate() {
        this.applyTransform();
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
        // Silver metallic gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#c4c4c4');
        gradient.addColorStop(0.2, '#e0e0e0');
        gradient.addColorStop(0.4, '#d0d0d0');
        gradient.addColorStop(0.6, '#e8e8e8');
        gradient.addColorStop(0.8, '#d4d4d4');
        gradient.addColorStop(1, '#b8b8b8');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Add subtle pattern texture
        this.ctx.globalAlpha = 0.03;
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            this.ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#999';
            this.ctx.fillRect(x, y, 2, 2);
        }
        this.ctx.globalAlpha = 1;
        
        // Scratch hint text
        this.ctx.font = 'bold 14px Unbounded, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#777';
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
    
    const scratch = new ScratchCard('scratch-canvas', {
        brushSize: 45,
        revealThreshold: 80,
        onProgress: (percent) => {
            // Progress tracking (no UI)
        },
        onReveal: () => {
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
