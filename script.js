// Initialize Telegram Web App
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    
    if (tg.requestFullscreen) {
        tg.requestFullscreen();
    }
    
    if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
    }
    
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#0a0a0f');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#a0a0a0');
}

// ============================================
// HOLOGRAPHIC CARD WITH THREE.JS
// ============================================

class HolographicCard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.offsetWidth || 300;
        this.height = this.container.offsetHeight || 300;
        
        this.rotationX = 0;
        this.rotationY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        
        this.init();
        this.setupGyroscope();
        this.animate();
    }
    
    init() {
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 2.5;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true 
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);
        
        // Create holographic card
        this.createCard();
        
        // Lights
        this.addLights();
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }
    
    createCard() {
        // Card geometry (slightly rounded edges effect with segments)
        const geometry = new THREE.PlaneGeometry(1.8, 1.8, 64, 64);
        
        // Custom holographic shader material
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                rotationX: { value: 0 },
                rotationY: { value: 0 },
                colorA: { value: new THREE.Color('#667eea') },
                colorB: { value: new THREE.Color('#764ba2') },
                colorC: { value: new THREE.Color('#f093fb') },
                colorD: { value: new THREE.Color('#43e97b') },
                colorE: { value: new THREE.Color('#38f9d7') }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    vNormal = normal;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float rotationX;
                uniform float rotationY;
                uniform vec3 colorA;
                uniform vec3 colorB;
                uniform vec3 colorC;
                uniform vec3 colorD;
                uniform vec3 colorE;
                
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                // Holographic rainbow effect
                vec3 holographic(vec2 uv, float angle) {
                    float holo = sin(uv.x * 20.0 + uv.y * 15.0 + angle * 5.0 + time * 2.0) * 0.5 + 0.5;
                    holo += sin(uv.x * 30.0 - uv.y * 20.0 + angle * 3.0 + time * 1.5) * 0.3;
                    holo += sin((uv.x + uv.y) * 25.0 + time * 3.0) * 0.2;
                    return mix(
                        mix(colorA, colorB, holo),
                        mix(colorC, mix(colorD, colorE, holo), sin(holo * 3.14159)),
                        sin(angle * 2.0 + time) * 0.5 + 0.5
                    );
                }
                
                // Sparkle effect
                float sparkle(vec2 uv, float time) {
                    vec2 grid = fract(uv * 30.0);
                    float spark = sin(grid.x * 31.4159 + time * 5.0) * sin(grid.y * 31.4159 + time * 4.0);
                    spark = pow(max(spark, 0.0), 20.0);
                    return spark * 0.5;
                }
                
                void main() {
                    vec2 uv = vUv;
                    
                    // Calculate angle based on rotation for holographic shift
                    float angle = rotationX * 0.5 + rotationY * 0.5;
                    
                    // Base holographic color
                    vec3 holoColor = holographic(uv, angle);
                    
                    // Add iridescent shimmer based on view angle
                    float shimmer = sin(uv.x * 10.0 + rotationY * 10.0) * 0.5 + 0.5;
                    shimmer *= sin(uv.y * 10.0 + rotationX * 10.0) * 0.5 + 0.5;
                    
                    vec3 shimmerColor = mix(colorD, colorE, shimmer);
                    holoColor = mix(holoColor, shimmerColor, 0.3);
                    
                    // Add sparkles
                    float spark = sparkle(uv, time);
                    holoColor += vec3(spark);
                    
                    // Fresnel-like edge glow
                    float edge = 1.0 - max(abs(uv.x - 0.5) * 2.0, abs(uv.y - 0.5) * 2.0);
                    edge = pow(edge, 0.3);
                    
                    // Vignette
                    float vignette = smoothstep(0.0, 0.7, edge);
                    
                    // Final color with slight darkening at edges
                    vec3 finalColor = holoColor * vignette;
                    finalColor += vec3(0.1) * (1.0 - vignette); // subtle border
                    
                    // Add overall brightness boost
                    finalColor *= 1.2;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.FrontSide
        });
        
        this.card = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.card);
    }
    
    addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(2, 2, 2);
        this.scene.add(pointLight);
    }
    
    setupGyroscope() {
        // Request permission for iOS 13+
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            // Will be triggered on user interaction
            document.addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            this.bindGyroscope();
                        }
                    })
                    .catch(console.error);
            }, { once: true });
        } else {
            this.bindGyroscope();
        }
        
        // Fallback: mouse/touch movement
        this.setupMouseControl();
    }
    
    bindGyroscope() {
        window.addEventListener('deviceorientation', (e) => {
            if (e.beta !== null && e.gamma !== null) {
                // beta: front-back tilt (-180 to 180)
                // gamma: left-right tilt (-90 to 90)
                this.targetRotationX = THREE.MathUtils.clamp(e.beta, -30, 30) * 0.02;
                this.targetRotationY = THREE.MathUtils.clamp(e.gamma, -30, 30) * 0.02;
            }
        });
    }
    
    setupMouseControl() {
        const wrapper = this.container.parentElement;
        
        wrapper.addEventListener('mousemove', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            
            this.targetRotationY = x * 0.5;
            this.targetRotationX = -y * 0.5;
        });
        
        wrapper.addEventListener('mouseleave', () => {
            this.targetRotationX = 0;
            this.targetRotationY = 0;
        });
        
        // Touch support
        wrapper.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const rect = wrapper.getBoundingClientRect();
                const x = (e.touches[0].clientX - rect.left) / rect.width - 0.5;
                const y = (e.touches[0].clientY - rect.top) / rect.height - 0.5;
                
                this.targetRotationY = x * 0.5;
                this.targetRotationX = -y * 0.5;
            }
        });
    }
    
    onResize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Smooth rotation interpolation
        this.rotationX += (this.targetRotationX - this.rotationX) * 0.1;
        this.rotationY += (this.targetRotationY - this.rotationY) * 0.1;
        
        // Apply rotation to card
        this.card.rotation.x = this.rotationX;
        this.card.rotation.y = this.rotationY;
        
        // Update shader uniforms
        this.material.uniforms.time.value += 0.016;
        this.material.uniforms.rotationX.value = this.rotationX;
        this.material.uniforms.rotationY.value = this.rotationY;
        
        this.renderer.render(this.scene, this.camera);
    }
    
    dispose() {
        this.renderer.dispose();
        this.material.dispose();
        this.card.geometry.dispose();
    }
}

// ============================================
// SCRATCH CARD
// ============================================

class ScratchCard {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas not found:', canvasId);
            return;
        }
        
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
        this.hapticInterval = 50;
        
        // Wait for layout to settle
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.init();
            });
        });
    }
    
    init() {
        this.setupCanvas();
        this.drawScratchLayer();
        this.bindEvents();
        console.log('Scratch card initialized', this.width, this.height);
    }
    
    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.width = rect.width || 300;
        this.height = rect.height || 300;
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        console.log('Canvas setup:', this.width, this.height);
    }
    
    drawScratchLayer() {
        // Silver metallic gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#a8a8a8');
        gradient.addColorStop(0.2, '#d0d0d0');
        gradient.addColorStop(0.4, '#c0c0c0');
        gradient.addColorStop(0.6, '#d8d8d8');
        gradient.addColorStop(0.8, '#b8b8b8');
        gradient.addColorStop(1, '#c8c8c8');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Add text
        this.ctx.save();
        this.ctx.font = 'bold 16px Unbounded, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#666666';
        this.ctx.fillText('✨ СОТРИ МЕНЯ ✨', this.width / 2, this.height / 2);
        this.ctx.restore();
        
        console.log('Scratch layer drawn');
    }
    
    bindEvents() {
        // Mouse
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleEnd());
        this.canvas.addEventListener('mouseleave', () => this.handleEnd());
        
        // Touch
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleEnd());
        this.canvas.addEventListener('touchcancel', () => this.handleEnd());
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
        
        // Haptic feedback
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
        
        this.ctx.beginPath();
        this.ctx.arc(to.x, to.y, this.options.brushSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    checkProgress() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        let transparent = 0;
        const total = data.length / 4;
        
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 128) transparent++;
        }
        
        const percentage = Math.round((transparent / total) * 100);
        this.options.onProgress(percentage);
        
        if (percentage >= this.options.revealThreshold && !this.isRevealed) {
            this.reveal();
        }
    }
    
    reveal() {
        this.isRevealed = true;
        
        this.canvas.style.transition = 'opacity 0.5s ease-out';
        this.canvas.style.opacity = '0';
        
        this.canvas.parentElement.classList.add('revealed');
        document.getElementById('content').classList.add('visible');
        
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
        }
        
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
    const container = document.querySelector('.app-container');
    
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: ${6 + Math.random() * 8}px;
            height: ${6 + Math.random() * 8}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none;
            left: ${Math.random() * 100}vw;
            top: -20px;
            opacity: 1;
            transform: rotate(${Math.random() * 360}deg);
            animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4500);
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
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize holographic card
    const holoCard = new HolographicCard('three-container');
    
    // Initialize scratch card
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const hint = document.querySelector('.hint');
    
    const scratchCard = new ScratchCard('scratch-canvas', {
        brushSize: 45,
        revealThreshold: 80,
        onProgress: (percentage) => {
            progressFill.style.width = percentage + '%';
            progressText.textContent = `Стёрто: ${percentage}%`;
            
            if (percentage > 5) {
                hint.classList.add('hidden');
            }
        },
        onReveal: () => {
            progressText.textContent = '🎉 Открыто!';
            progressFill.style.width = '100%';
            createConfetti();
        }
    });
    
    // Expose for debugging
    window.holoCard = holoCard;
    window.scratchCard = scratchCard;
});

// Set custom content
function setGiftContent(html) {
    document.getElementById('content').innerHTML = html;
}
window.setGiftContent = setGiftContent;
