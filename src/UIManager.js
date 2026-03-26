// UIManager.js — Phase 0: UI & State Management

export class UIManager {
    constructor(onGameStart) {
        this.onGameStart = onGameStart;
        this.playerName = '';
        this.selectedChar = 'timmy';

        this._buildHTML();
        this._buildStyles();
        this._bindEvents();
        this._startLogoAnimation();
    }

    _buildHTML() {
        document.body.insertAdjacentHTML('beforeend', `
        <!-- MAIN MENU -->
        <div id="main-menu">
            <div class="menu-starfield" id="starfield"></div>
            <div class="menu-content">
                <div class="sparc-title" id="sparc-title">
                    <span class="sparc-letter" data-letter="S" style="--hue:340">S</span>
                    <span class="sparc-letter" data-letter="P" style="--hue:30">P</span>
                    <span class="sparc-letter" data-letter="A" style="--hue:200">A</span>
                    <span class="sparc-letter" data-letter="R" style="--hue:120">R</span>
                    <span class="sparc-letter" data-letter="C" style="--hue:55">C</span>
                </div>
                <button class="sparc-btn" id="menu-start-btn" disabled style="opacity:0.5; cursor:wait;">
                    <span class="spinner"></span> SPARC Initializing...
                </button>
            </div>
        </div>

        <!-- CHARACTER SELECT (Main Menu) -->
        <div id="char-select" style="display:none">
            <div class="screen-header">CHOOSE YOUR PILOT</div>
            <div class="char-grid">
                <div class="char-card selected" id="char-timmy" data-char="timmy" data-model="/assets/models/pilot_timmy.fbx">
                    <div class="char-avatar">🧑‍🚀</div>
                    <div class="char-name">PILOT TIMMY</div>
                    <div class="char-desc">Fearless explorer. Certified station pilot.</div>
                    <div class="char-badge">✓ UNLOCKED</div>
                </div>
                <div class="char-card" id="char-dummy" data-char="dummy" data-model="/assets/models/pilot_dummy.fbx">
                    <div class="char-avatar">🤖</div>
                    <div class="char-name">TEST DUMMY</div>
                    <div class="char-desc">Tactical specialist. Enhanced reflexes.</div>
                    <div class="char-badge">✓ UNLOCKED</div>
                </div>
                <div class="char-card" id="char-ami" data-char="ami" data-model="/assets/models/pilot_ami.fbx">
                    <div class="char-avatar">🌟</div>
                    <div class="char-name">PILOT AMI</div>
                    <div class="char-desc">Stellar navigator. Expert in deep-space routes.</div>
                    <div class="char-badge">✓ UNLOCKED</div>
                </div>
                <div class="char-card" id="char-jackie" data-char="jackie" data-model="/assets/models/pilot_jackie.fbx">
                    <div class="char-avatar">⚡</div>
                    <div class="char-name">PILOT JACKIE</div>
                    <div class="char-desc">Speed demon. Breaks every throttle record.</div>
                    <div class="char-badge">✓ UNLOCKED</div>
                </div>
                <div class="char-card" id="char-michelle" data-char="michelle" data-model="/assets/models/pilot_michelle.fbx">
                    <div class="char-avatar">🛡️</div>
                    <div class="char-name">PILOT MICHELLE</div>
                    <div class="char-desc">Combat veteran. Unbreakable under pressure.</div>
                    <div class="char-badge">✓ UNLOCKED</div>
                </div>
            </div>
            <button class="sparc-btn" id="char-confirm-btn">CONFIRM PILOT →</button>
        </div>

        <!-- IN-GAME CHARACTER SELECT (Closet) -->
        <div id="ingame-char-select" style="display:none; position:fixed; inset:0; z-index:800; background:rgba(2,10,20,0.92); flex-direction:column; align-items:center; justify-content:center;">
            <div class="screen-header" style="margin-top:0;">CHANGE PILOT</div>
            <div class="char-grid" id="ingame-char-grid">
                <div class="char-card selected" data-model="/assets/models/pilot_timmy.fbx"><div class="char-avatar">🧑‍🚀</div><div class="char-name">PILOT TIMMY</div></div>
                <div class="char-card" data-model="/assets/models/pilot_dummy.fbx"><div class="char-avatar">🤖</div><div class="char-name">TEST DUMMY</div></div>
                <div class="char-card" data-model="/assets/models/pilot_ami.fbx"><div class="char-avatar">🌟</div><div class="char-name">PILOT AMI</div></div>
                <div class="char-card" data-model="/assets/models/pilot_jackie.fbx"><div class="char-avatar">⚡</div><div class="char-name">PILOT JACKIE</div></div>
                <div class="char-card" data-model="/assets/models/pilot_michelle.fbx"><div class="char-avatar">🛡️</div><div class="char-name">PILOT MICHELLE</div></div>
            </div>
            <div style="display:flex; gap:20px; margin-top:10px;">
                <button class="sparc-btn" id="ingame-char-confirm-btn">EQUIP PILOT →</button>
                <button class="sparc-btn" id="ingame-char-close-btn" style="background:#444; box-shadow:0 5px 0 #222;">CANCEL</button>
            </div>
        </div>

        <!-- NAME INPUT -->
        <div id="name-input" style="display:none">
            <div class="screen-header">ENTER YOUR NAME, CADET</div>
            <div class="name-card">
                <div id="selected-pilot-display" class="selected-pilot-display">🧑‍🚀 Pilot Timmy</div>
                <input type="text" id="player-name-input" class="sparc-input" 
                       placeholder="Enter callsign..." maxlength="16" autocomplete="off" />
                <div class="name-hint">Your callsign will appear in mission logs.</div>
                <button class="sparc-btn" id="launch-btn">🚀 LAUNCH MISSION</button>
            </div>
        </div>

        <!-- MISSION HUB: top-left -->
        <div id="mission-hub" style="display:none">
            <div class="hub-header">📡 MISSION HUB</div>
            <div class="hub-callsign" id="hub-callsign">CADET</div>
            <div class="hub-divider"></div>
            <div class="hub-objective" id="hub-objective">OBJECTIVE: CHECK BIO-UNIT</div>
        </div>

        <!-- DIALOGUE OVERLAY -->
        <div id="dialogue-overlay" style="display:none"></div>

        <!-- DIALOGUE BOX (centred) -->
        <div id="dialogue-box" style="display:none">
            <div class="dlg-speaker" id="dlg-speaker"></div>
            <div class="dlg-text" id="dlg-text"></div>
            <div class="dlg-hint">▶ SPACE / ENTER to continue</div>
        </div>
        
        <!-- THE BLACK OVERLAY -->
        <div id="fade-overlay"></div>
        `);
    }

    _buildStyles() {
        const style = document.createElement('style');
        style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@300;400;700&display=swap');

        #main-menu, #char-select, #name-input {
            position: fixed;
            inset: 0;
            z-index: 500;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', sans-serif;
        }

        /* ---- MAIN MENU ---- */
        #main-menu {
            background: url('/assets/images/menu_bg.png') center/cover no-repeat;
            background-color: #020a14;
            overflow: hidden;
        }
        #main-menu::after {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at 50% 60%, rgba(2,10,25,0.3) 0%, rgba(0,0,0,0.65) 100%);
            pointer-events: none;
        }

        .menu-starfield {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        .star {
            position: absolute;
            border-radius: 50%;
            background: white;
            animation: twinkle var(--dur) infinite alternate;
        }
        @keyframes twinkle {
            from { opacity: var(--a); transform: scale(1); }
            to   { opacity: 1;        transform: scale(1.4); }
        }

        .menu-content {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
        }

        /* ---- SPARC ANIMATED LOGO ---- */
        .sparc-title {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }
        
        /* SPINNER */
        .spinner {
            width: 14px; height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: #00f2ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            display: inline-block;
            vertical-align: middle;
            margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* THE BLACK OVERLAY */
        #fade-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: #000000; opacity: 0; pointer-events: none;
            transition: opacity 0.4s ease;
        }

        .sparc-letter {
            font-family: 'Orbitron', sans-serif;
            font-size: clamp(64px, 10vw, 110px);
            font-weight: 900;
            color: hsl(var(--hue), 90%, 65%);
            text-shadow:
                0 0 20px hsl(var(--hue), 100%, 70%),
                0 4px 0 hsl(var(--hue), 100%, 30%);
            animation: letter-float 2.5s ease-in-out infinite;
            animation-delay: calc(var(--i, 0) * 0.15s);
            display: inline-block;
            cursor: default;
            transition: transform 0.1s;
        }
        .sparc-letter:nth-child(1) { --i: 0; }
        .sparc-letter:nth-child(2) { --i: 1; }
        .sparc-letter:nth-child(3) { --i: 2; }
        .sparc-letter:nth-child(4) { --i: 3; }
        .sparc-letter:nth-child(5) { --i: 4; }

        .sparc-letter:hover {
            animation: letter-bounce 0.3s ease;
            transform: scale(1.25) rotate(-5deg);
        }

        @keyframes letter-float {
            0%, 100% { transform: translateY(0px);  }
            50%       { transform: translateY(-14px); }
        }
        @keyframes letter-bounce {
            0%   { transform: scale(1);    }
            40%  { transform: scale(1.3) rotate(8deg); }
            70%  { transform: scale(0.95) rotate(-4deg); }
            100% { transform: scale(1);    }
        }

        /* ---- BUTTONS ---- */
        .sparc-btn {
            background: #f26422;
            color: white;
            border: none;
            padding: 16px 52px;
            font-family: 'Orbitron', sans-serif;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 3px;
            text-transform: uppercase;
            border-radius: 50px;
            cursor: pointer;
            box-shadow: 0 5px 0 #b84000, 0 8px 30px rgba(242,100,34,0.4);
            transition: all 0.15s ease;
        }
        .sparc-btn:hover {
            background: #ff7b42;
            transform: translateY(-3px);
            box-shadow: 0 8px 0 #b84000, 0 12px 40px rgba(242,100,34,0.6);
        }
        .sparc-btn:active {
            transform: translateY(2px);
            box-shadow: 0 2px 0 #b84000;
        }

        /* ---- CHAR SELECT ---- */
        #char-select, #name-input {
            background: radial-gradient(ellipse at 50% 30%, #0d1f3c 0%, #020a14 100%);
        }
        .screen-header {
            font-family: 'Orbitron', sans-serif;
            font-size: clamp(22px, 3vw, 36px);
            font-weight: 900;
            letter-spacing: 4px;
            color: #00f2ff;
            text-shadow: 0 0 20px rgba(0,242,255,0.5);
            margin-bottom: 40px;
            text-transform: uppercase;
        }
        .char-grid {
            display: flex;
            gap: 28px;
            margin-bottom: 40px;
        }
        .char-card {
            background: rgba(0,10,30,0.7);
            border: 2px solid rgba(0,242,255,0.2);
            border-radius: 20px;
            padding: 32px 40px;
            width: 220px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
        }
        .char-card.selected {
            border-color: #00f2ff;
            box-shadow: 0 0 30px rgba(0,242,255,0.3), inset 0 0 20px rgba(0,242,255,0.05);
        }
        .char-card.locked {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .char-card:not(.locked):hover {
            transform: translateY(-6px);
            border-color: #00f2ff;
            box-shadow: 0 15px 40px rgba(0,0,0,0.5), 0 0 20px rgba(0,242,255,0.2);
        }
        .char-avatar { font-size: 64px; margin-bottom: 16px; }
        .char-name {
            font-family: 'Orbitron', sans-serif;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 2px;
            color: white;
            margin-bottom: 10px;
        }
        .char-desc { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 14px; line-height: 1.5; }
        .char-badge { font-size: 11px; font-weight: 700; color: #00f2ff; letter-spacing: 1px; }

        /* ---- NAME INPUT ---- */
        .name-card {
            background: rgba(0,10,30,0.7);
            border: 1px solid rgba(0,242,255,0.2);
            border-radius: 24px;
            padding: 48px 64px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            min-width: 440px;
        }
        .selected-pilot-display {
            font-size: 32px;
            color: rgba(255,255,255,0.8);
            font-family: 'Orbitron', sans-serif;
            font-size: 14px;
            letter-spacing: 2px;
            color: #00f2ff;
        }
        .sparc-input {
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(0,242,255,0.3);
            border-radius: 50px;
            padding: 16px 28px;
            font-family: 'Orbitron', sans-serif;
            font-size: 18px;
            color: white;
            outline: none;
            width: 100%;
            box-sizing: border-box;
            text-align: center;
            letter-spacing: 3px;
            transition: border-color 0.2s;
        }
        .sparc-input:focus {
            border-color: #00f2ff;
            box-shadow: 0 0 20px rgba(0,242,255,0.2);
        }
        .sparc-input::placeholder { color: rgba(255,255,255,0.25); letter-spacing: 2px; }
        .name-hint { font-size: 12px; color: rgba(255,255,255,0.3); letter-spacing: 1px; }

        /* ---- MISSION HUB (top-left) ---- */
        #mission-hub {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 200;
            display: flex;
            flex-direction: column;
            gap: 6px;
            background: rgba(0, 0, 0, 0.75);
            border: 1px solid rgba(0,242,255,0.5);
            border-radius: 12px;
            padding: 14px 20px;
            min-width: 240px;
            backdrop-filter: blur(4px);
            font-family: 'Inter', sans-serif;
        }
        .hub-header {
            font-family: 'Orbitron', sans-serif;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #00f2ff;
            text-shadow: 2px 2px 2px #000;
            text-transform: uppercase;
        }
        .hub-callsign {
            font-family: 'Orbitron', sans-serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #ffffff;
            text-shadow: 2px 2px 2px #000;
        }
        .hub-divider {
            height: 1px;
            background: linear-gradient(90deg, rgba(0,242,255,0.5), transparent);
            margin: 2px 0;
        }
        .hub-objective {
            font-size: 11px;
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 1.5px;
            color: #f2c94c;
            text-shadow: 2px 2px 2px #000;
            text-transform: uppercase;
        }

        /* ---- DIALOGUE OVERLAY ---- */
        #dialogue-overlay {
            position: fixed;
            inset: 0;
            z-index: 490;
            background: rgba(0, 0, 0, 0.60);
            pointer-events: none;
        }

        /* ---- DIALOGUE BOX (fixed bottom-center) ---- */
        #dialogue-box {
            position: fixed !important;
            bottom: 8% !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 500px;
            max-width: 90%;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            background: rgba(0, 0, 0, 0.88);
            border: 1px solid #00f2ff;
            border-radius: 10px;
            padding: 20px 32px;
            backdrop-filter: blur(8px);
            font-family: 'Inter', sans-serif;
            box-sizing: border-box;
        }
        .dlg-speaker {
            font-family: 'Orbitron', sans-serif;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #00f2ff;
            text-shadow: 2px 2px 2px #000;
            margin-bottom: 8px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .dlg-speaker.radio { color: #ff9f43; }
        .dlg-icon {
            width: 32px;
            height: 32px;
            border-radius: 4px;
            flex-shrink: 0;
        }
        .dlg-text {
            font-size: 15px;
            line-height: 1.75;
            color: #ffffff;
            text-shadow: 2px 2px 2px #000;
            margin-bottom: 12px;
        }
        .dlg-hint {
            font-size: 11px;
            color: rgba(255,255,255,0.4);
            text-align: right;
            letter-spacing: 1px;
            font-family: 'Orbitron', sans-serif;
        }

        /* screen transitions */
        .screen-fade-in { animation: fadeIn 0.4s ease forwards; }
        .screen-fade-out { animation: fadeOut 0.3s ease forwards; }
        @keyframes fadeIn  { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    _bindEvents() {
        // Main menu → Char select
        document.getElementById('menu-start-btn').addEventListener('click', () => {
            this._transition('main-menu', 'char-select');
        });

        // Main-menu char cards
        document.querySelectorAll('#char-select .char-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('#char-select .char-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedChar = card.dataset.char;
                this.selectedModel = card.dataset.model;
                // Update name screen display with matching icon and name
                const disp = document.getElementById('selected-pilot-display');
                if (disp) {
                    const avatar = card.querySelector('.char-avatar').textContent;
                    const name = card.querySelector('.char-name').textContent;
                    disp.textContent = `${avatar} ${name}`;
                }
            });
        });
        // Default model for timmy
        this.selectedModel = '/assets/models/pilot_timmy.fbx';

        // Char select → Name input
        document.getElementById('char-confirm-btn').addEventListener('click', () => {
            this._transition('char-select', 'name-input');
            setTimeout(() => document.getElementById('player-name-input').focus(), 400);
        });

        // Name input → Game start
        document.getElementById('launch-btn').addEventListener('click', () => {
            const name = document.getElementById('player-name-input').value.trim();
            this.playerName = name || 'CADET';

            const overlay = document.getElementById('fade-overlay');
            overlay.style.transition = 'opacity 0.8s ease';
            overlay.style.opacity = '1';

            setTimeout(() => {
                this._hideScreen('name-input');
                this.onGameStart(this.playerName, this.selectedChar, this.selectedModel);

                // MISSION HUB
                const hub = document.getElementById('mission-hub');
                const callsignEl = document.getElementById('hub-callsign');
                if (callsignEl) callsignEl.textContent = this.playerName.toUpperCase();
                if (hub) { hub.style.display = 'flex'; hub.classList.add('screen-fade-in'); }
                const objEl = document.getElementById('hub-objective');
                if (objEl) objEl.style.visibility = 'hidden';

                setTimeout(() => {
                    overlay.style.transition = 'opacity 3.0s ease';
                    overlay.style.opacity = '0';
                }, 500);

            }, 800);

            window.__missionHubMessage = (msg) => {
                this.queueDialogue([{ speaker: 'System', text: msg, isRadio: false }]);
            };
        });

        // Enter key on name input
        document.getElementById('player-name-input').addEventListener('keydown', (e) => {
            if (e.code === 'Enter') document.getElementById('launch-btn').click();
        });

        // ---- IN-GAME CHAR SELECT (Closet) ----
        let ingameSelectedModel = null;
        document.querySelectorAll('#ingame-char-grid .char-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('#ingame-char-grid .char-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                ingameSelectedModel = card.dataset.model;
            });
        });

        document.getElementById('ingame-char-confirm-btn').addEventListener('click', () => {
            if (!ingameSelectedModel) return;
            const overlay = document.getElementById('ingame-char-select');
            overlay.style.display = 'none';
            UIManager.isCharSelectOpen = false;
            if (typeof window.onCharacterSelected === 'function') {
                window.onCharacterSelected(ingameSelectedModel);
            }
        });

        document.getElementById('ingame-char-close-btn').addEventListener('click', () => {
            document.getElementById('ingame-char-select').style.display = 'none';
            UIManager.isCharSelectOpen = false;
            if (typeof window.onCharacterSelectClosed === 'function') window.onCharacterSelectClosed();
        });

        // GLOBAL OPENER: called by StationStage closet interaction
        window.openCharacterSelect = (currentModel) => {
            ingameSelectedModel = currentModel || null;
            document.querySelectorAll('#ingame-char-grid .char-card').forEach(c => {
                c.classList.toggle('selected', c.dataset.model === currentModel);
            });
            document.getElementById('ingame-char-select').style.display = 'flex';
            UIManager.isCharSelectOpen = true;
        };

        // CLICK-TO-ADVANCE dialogue
        document.addEventListener('keydown', (e) => {
            if (e.code !== 'Space' && e.code !== 'Enter') return;
            if (UIManager.isCharSelectOpen) return; // Don't advance dialogue when wardrobe is open
            const box = document.getElementById('dialogue-box');
            if (!box || box.style.display === 'none') return;
            if (this._dlgGuard) return;
            e.preventDefault();
            this._advanceDialogue();
        });
    }

    _transition(fromId, toId) {
        const overlay = document.getElementById('fade-overlay');
        overlay.style.transition = 'opacity 0.4s ease';
        overlay.style.opacity = '1';
        setTimeout(() => {
            const from = document.getElementById(fromId);
            const to = document.getElementById(toId);
            if (from) from.style.display = 'none';
            if (to) to.style.display = 'flex';
            overlay.style.opacity = '0';
        }, 400);
    }

    _hideScreen(id) {
        const el = document.getElementById(id);
        el.classList.add('screen-fade-out');
        setTimeout(() => {
            el.style.display = 'none';
            el.classList.remove('screen-fade-out');
        }, 300);
    }

    _startLogoAnimation() {
        const sf = document.getElementById('starfield');
        if (!sf) return;
        for (let i = 0; i < 120; i++) {
            const s = document.createElement('div');
            const size = Math.random() * 2.5 + 0.5;
            s.className = 'star';
            s.style.cssText = `
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                width: ${size}px;
                height: ${size}px;
                --dur: ${(Math.random() * 2 + 1.5).toFixed(1)}s;
                --a: ${(Math.random() * 0.4 + 0.2).toFixed(2)};
                animation-delay: ${(Math.random() * 3).toFixed(1)}s;
            `;
            s.dataset.baseTop = parseFloat(s.style.top);
            s.dataset.baseLeft = parseFloat(s.style.left);
            sf.appendChild(s);
        }

        let time = 0;
        const animateFlow = () => {
            if (document.getElementById('main-menu').style.display === 'none') return;
            time += 0.01;
            const stars = document.querySelectorAll('.star');
            stars.forEach((s, idx) => {
                const baseTop = parseFloat(s.dataset.baseTop);
                // Drift slowly right (time*0.5 adds 0.005 per frame on avg) wrapped at 100%
                let currentLeft = parseFloat(s.dataset.baseLeft) + (time * 0.5);
                s.style.top = `calc(${baseTop}% + ${Math.sin(time + idx * 0.1) * 20}px)`;
                s.style.left = `${currentLeft % 100}%`;
            });
            requestAnimationFrame(animateFlow);
        };
        requestAnimationFrame(animateFlow);

        const letters = document.querySelectorAll('.sparc-letter');
        letters.forEach((l, i) => {
            l.style.animationDelay = `${i * 0.15}s`;
        });
    }

    enableStartButton() {
        const btn = document.getElementById('menu-start-btn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🚀 LAUNCH MISSION';
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    }

    // DIALOGUE QUEUE ENGINE
    queueDialogue(lines, onComplete) {
        this._dlgQueue = [...(lines || [])];
        this._dlgGuard = false;
        this._dlgOnComplete = onComplete || null;
        UIManager.isDialogueActive = true;
        this._advanceDialogue();
    }

    _advanceDialogue() {
        const box = document.getElementById('dialogue-box');
        const overlay = document.getElementById('dialogue-overlay');
        const spkEl = document.getElementById('dlg-speaker');
        const txtEl = document.getElementById('dlg-text');
        if (!box) return;

        if (!this._dlgQueue || this._dlgQueue.length === 0) {
            // Queue empty — unlock movement and fire callback
            UIManager.isDialogueActive = false;
            box.style.display = 'none';
            if (overlay) overlay.style.display = 'none';
            if (typeof this._dlgOnComplete === 'function') {
                const cb = this._dlgOnComplete;
                this._dlgOnComplete = null;
                cb();
            }
            return;
        }

        const line = this._dlgQueue.shift();

        // ICON SYSTEM: draw radio icon on canvas when isRadio
        let iconHtml = '';
        if (line.isRadio) {
            const ic = document.createElement('canvas');
            ic.width = 64; ic.height = 64;
            const cx = ic.getContext('2d');
            // Radio body
            cx.fillStyle = '#222';
            cx.roundRect(8, 20, 48, 32, 6);
            cx.fill();
            cx.strokeStyle = '#ff9f43'; cx.lineWidth = 2; cx.stroke();
            // Antenna
            cx.beginPath(); cx.moveTo(32, 20); cx.lineTo(48, 6);
            cx.strokeStyle = '#ff9f43'; cx.lineWidth = 2; cx.stroke();
            // Speaker grille lines
            for (let i = 0; i < 3; i++) {
                cx.fillStyle = '#ff9f43';
                cx.fillRect(14, 28 + i * 7, 22, 3);
            }
            // LED dot
            cx.beginPath(); cx.arc(46, 30, 4, 0, Math.PI * 2);
            cx.fillStyle = '#ff3333'; cx.fill();
            iconHtml = `<img class="dlg-icon" src="${ic.toDataURL()}" alt="radio" />`;
        }

        spkEl.innerHTML = iconHtml + (line.isRadio ? line.speaker : '🧑‍🚀 ' + line.speaker);
        spkEl.className = 'dlg-speaker' + (line.isRadio ? ' radio' : '');
        txtEl.textContent = line.text;

        box.style.display = 'block';
        box.classList.add('screen-fade-in');
        if (overlay) overlay.style.display = 'block';

        // INPUT GUARD: ignore advance for 1.0s
        this._dlgGuard = true;
        clearTimeout(this._dlgGuardTimer);
        this._dlgGuardTimer = setTimeout(() => { this._dlgGuard = false; }, 1000);

        console.log('TOTAL FOCUS ENGINE ONLINE');
    }

    // Legacy compat: single-line call
    showDialogue(speaker, text, isRadio = false) {
        this.queueDialogue([{ speaker, text, isRadio }]);
    }

    showMainMenu() {
        const menu = document.getElementById('main-menu');
        menu.style.display = 'flex';
        menu.classList.add('screen-fade-in');
        setTimeout(() => menu.classList.remove('screen-fade-in'), 400);
    }
}

// Static flag: controls movement/camera lock in StationStage
UIManager.isDialogueActive = false;
UIManager.isCharSelectOpen = false;
