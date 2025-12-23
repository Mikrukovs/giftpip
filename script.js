// Initialize Telegram Web App
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    
    // Request fullscreen mode
    if (tg.requestFullscreen) {
        tg.requestFullscreen();
    }
    
    // Disable vertical swipes to prevent closing
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }
    
    // Lock orientation if supported
    if (tg.lockOrientation) {
        tg.lockOrientation();
    }
    
    // Apply Telegram theme colors
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#1a1a2e');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#a0a0a0');
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#16213e');
}

class ScratchCard {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.options = {
            brushSize: options.brushSize || 40,
            revealThreshold: options.revealThreshold || 50,
            scratchColor: options.scratchColor || null,
            onProgress: options.onProgress || (() => {}),
            onReveal: options.onReveal || (() => {})
        };
        
        this.isDrawing = false;
        this.isRevealed = false;
        this.lastPoint = null;
        this.lastHapticTime = 0;
        this.hapticInterval = 50; // ms between haptic feedbacks
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.drawScratchLayer();
        this.bindEvents();
    }
    
    setupCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Simple setup without DPI scaling for reliability
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        this.width = rect.width;
        this.height = rect.height;
    }
    
    drawScratchLayer() {
        // Clear canvas first
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Create metallic scratch surface
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#b0b0b0');
        gradient.addColorStop(0.3, '#d5d5d5');
        gradient.addColorStop(0.5, '#c8c8c8');
        gradient.addColorStop(0.7, '#d0d0d0');
        gradient.addColorStop(1, '#a8a8a8');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Add scratch instructions
        this.addInstructions();
    }
    
    addInstructions() {
        this.ctx.save();
        
        // Draw text
        this.ctx.font = '600 18px Unbounded, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Text shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillText('✨ СОТРИ МЕНЯ ✨', this.width / 2 + 1, this.height / 2 + 1);
        
        // Main text
        this.ctx.fillStyle = '#666666';
        this.ctx.fillText('✨ СОТРИ МЕНЯ ✨', this.width / 2, this.height / 2);
        
        this.ctx.restore();
    }
    
    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleStart.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleEnd.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleEnd.bind(this));
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.handleEnd.bind(this));
        
        // Window resize
        window.addEventListener('resize', () => {
            if (!this.isRevealed) {
                this.setupCanvas();
                this.drawScratchLayer();
            }
        });
    }
    
    getEventPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    handleStart(e) {
        if (this.isRevealed) return;
        
        e.preventDefault();
        this.isDrawing = true;
        this.lastPoint = this.getEventPosition(e);
        
        // Haptic feedback
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }
    
    handleMove(e) {
        if (!this.isDrawing || this.isRevealed) return;
        
        e.preventDefault();
        
        const currentPoint = this.getEventPosition(e);
        this.scratch(this.lastPoint, currentPoint);
        this.lastPoint = currentPoint;
        
        // Continuous haptic feedback while scratching
        const now = Date.now();
        if (now - this.lastHapticTime > this.hapticInterval) {
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
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
        
        // Add some extra points for better coverage
        this.ctx.beginPath();
        this.ctx.arc(to.x, to.y, this.options.brushSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    checkProgress() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        let transparent = 0;
        let total = data.length / 4;
        
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 128) {
                transparent++;
            }
        }
        
        const percentage = Math.round((transparent / total) * 100);
        this.options.onProgress(percentage);
        
        if (percentage >= this.options.revealThreshold && !this.isRevealed) {
            this.reveal();
        }
    }
    
    reveal() {
        this.isRevealed = true;
        
        // Animate canvas fade out
        this.canvas.style.transition = 'opacity 0.5s ease-out';
        this.canvas.style.opacity = '0';
        
        // Add revealed class to container
        this.canvas.parentElement.classList.add('revealed');
        
        // Haptic feedback
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
        
        this.options.onReveal();
        
        // Hide canvas completely after animation
        setTimeout(() => {
            this.canvas.style.display = 'none';
        }, 500);
    }
    
    reset() {
        this.isRevealed = false;
        this.canvas.style.display = 'block';
        this.canvas.style.opacity = '1';
        this.canvas.style.transition = 'none';
        this.canvas.parentElement.classList.remove('revealed');
        this.setupCanvas();
        this.drawScratchLayer();
    }
}

// Initialize scratch card
document.addEventListener('DOMContentLoaded', () => {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const hint = document.querySelector('.hint');
    
    const scratchCard = new ScratchCard('scratch-canvas', {
        brushSize: 45,
        revealThreshold: 80,
        onProgress: (percentage) => {
            progressFill.style.width = percentage + '%';
            progressText.textContent = `Стёрто: ${percentage}%`;
            
            // Hide hint after user starts scratching
            if (percentage > 5) {
                hint.style.opacity = '0';
                hint.style.transform = 'translateY(10px)';
                hint.style.transition = 'all 0.3s ease-out';
            }
        },
        onReveal: () => {
            progressText.textContent = '🎉 Открыто!';
            progressFill.style.width = '100%';
            
            // Show confetti or celebration effect
            createConfetti();
        }
    });
    
    // Make scratch card accessible globally for debugging
    window.scratchCard = scratchCard;
});

// Simple confetti effect
function createConfetti() {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#ffd700', '#ff6b6b'];
    const container = document.querySelector('.app-container');
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none;
            left: ${Math.random() * 100}vw;
            top: -10px;
            opacity: 1;
            transform: rotate(${Math.random() * 360}deg);
            animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        
        container.appendChild(confetti);
        
        // Remove confetti after animation
        setTimeout(() => confetti.remove(), 4000);
    }
    
    // Add confetti animation if not exists
    if (!document.getElementById('confetti-style')) {
        const style = document.createElement('style');
        style.id = 'confetti-style';
        style.textContent = `
            @keyframes confettiFall {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Function to set custom content (can be called later)
function setGiftContent(html) {
    const contentLayer = document.getElementById('content');
    contentLayer.innerHTML = html;
}

// Expose function globally
window.setGiftContent = setGiftContent;

