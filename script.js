let sanraiData = JSON.parse(localStorage.getItem('sanraiData')) || { history: [], bin: [] };

// Helper to safely get element
const $ = (id) => document.getElementById(id);

// ==========================================
// 1. APP & INITIALIZATION
// ==========================================
const App = {
    init: () => {
        // App Page Logic
        if ($('consentOverlay')) {
            const hasConsent = localStorage.getItem('sanrai_consent');
            if (!hasConsent) {
                $('consentOverlay').style.display = 'flex';
                document.body.classList.add('no-scroll');
            } else if (!localStorage.getItem('sanrai_apiKey')) {
                App.startTour();
            }
        }

        if ($('apiKey')) $('apiKey').value = localStorage.getItem('sanrai_apiKey') || '';
        if ($('notifTime1')) $('notifTime1').value = localStorage.getItem('sanrai_notifTime1') || "09:00";
        if ($('notifTime2')) $('notifTime2').value = localStorage.getItem('sanrai_notifTime2') || "17:00";
        
        const draft = localStorage.getItem('draft_rawInput');
        if (draft && $('rawInput')) $('rawInput').value = draft;

        // FIX: Ensuring date is visible and set to today
        if ($('workDate')) $('workDate').valueAsDate = new Date(); 

        if ($('rawInput')) {
            $('rawInput').addEventListener('input', (e) => {
                localStorage.setItem('draft_rawInput', e.target.value);
            });
        }

        Archive.cleanBin();
        Engine.initNotifications();
    },

    acceptConsent: () => {
        localStorage.setItem('sanrai_consent', 'true');
        if ($('consentOverlay')) $('consentOverlay').style.display = 'none';
        document.body.classList.remove('no-scroll');
        App.startTour();
    },

    saveSettings: () => {
        if ($('apiKey')) {
            localStorage.setItem('sanrai_apiKey', $('apiKey').value);
            localStorage.setItem('sanrai_notifTime1', $('notifTime1').value);
            localStorage.setItem('sanrai_notifTime2', $('notifTime2').value);
            UI.closeModal('settingsModal');
            Engine.initNotifications(); 
        }
    },

    tourStep: 1,
    startTour: () => {
        UI.closeModal('settingsModal');
        if ($('tourOverlay')) $('tourOverlay').style.display = 'flex';
        document.body.classList.add('no-scroll');
        App.tourStep = 1;
        App.renderTourStep();
    },
    renderTourStep: () => {
        const content = $('tourContent');
        if (!content) return;
        if (App.tourStep === 1) {
            content.innerHTML = `<h2 class="accent-text mb-15">1. Brain Dump & Dates</h2>
                <p class="small-text mb-15">Dump your notes in any format. Use the Date picker for previous days.</p>
                <button class="primary-btn mt-20" onclick="App.tourStep++; App.renderTourStep()">Next</button>`;
        } else if (App.tourStep === 2) {
            content.innerHTML = `<h2 class="accent-text mb-15">2. Clarity & Focus</h2>
                <p class="small-text mb-15">AI structures your mess into Scrum updates and an 8-hour Timesheet.</p>
                <button class="primary-btn mt-20" onclick="App.tourStep++; App.renderTourStep()">Next</button>`;
        } else if (App.tourStep === 3) {
            content.innerHTML = `<h2 class="accent-text mb-15">3. Smart Reminders</h2>
                <p class="small-text mb-15">Set Morning and Evening alerts in Settings to stay on track!</p>
                <button class="primary-btn mt-20" onclick="App.finishTour()">Get Started</button>`;
        }
    },
    finishTour: () => {
        if ($('tourOverlay')) $('tourOverlay').style.display = 'none';
        document.body.classList.remove('no-scroll');
        if (!localStorage.getItem('sanrai_apiKey')) UI.openModal('settingsModal');
    }
};

// ==========================================
// 2. UI MODULE
// ==========================================
const UI = {
    openModal: (id) => { if ($(id)) { $(id).style.display = 'flex'; document.body.classList.add('no-scroll'); } },
    closeModal: (id) => { if ($(id)) { $(id).style.display = 'none'; document.body.classList.remove('no-scroll'); } },
    
    switchOutputTab: (tab, btnElement) => {
        document.querySelectorAll('.output-panel .tab-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        if ($('scrumView')) $('scrumView').style.display = tab === 'scrum' ? 'block' : 'none';
        if ($('timesheetView')) $('timesheetView').style.display = tab === 'timesheet' ? 'block' : 'none';
    },
    
    copyScrum: () => {
        const text = `Yesterday: ${$('outYesterday').innerText}\nToday: ${$('outToday').innerText}\nBlockers: ${$('outBlockers').innerText}`;
        navigator.clipboard.writeText(text).then(() => alert("Scrum notes copied!"));
    },

    togglePassword: () => {
        const input = $('apiKey');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    },

    openArchive: () => {
        UI.openModal('historyModal');
        if ($('universalSearch')) $('universalSearch').value = ''; 
        Archive.renderList();
    }
};

// ==========================================
// 3. ENGINE MODULE
// ==========================================
const Engine = {
    notifInterval: null,
    initNotifications: () => {
        const btn = $('notifBtn');
        if (Notification.permission === 'granted' && btn) {
            btn.innerText = '🔔 Alerts: On';
            btn.style.color = 'var(--accent)';
            if(Engine.notifInterval) clearInterval(Engine.notifInterval);
            Engine.notifInterval = setInterval(() => {
                const time1 = localStorage.getItem('sanrai_notifTime1') || "09:00";
                const time2 = localStorage.getItem('sanrai_notifTime2') || "17:00";
                const now = new Date();
                const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
                if((currentTime === time1 || currentTime === time2) && now.getSeconds() < 10) { 
                    new Notification("SANRAI Alert", { body: "Time to prep your Scrum notes!", icon: "https://uploads.onecompiler.io/44hamhdu3/44j87h6rm/1000074177.webp" });
                }
            }, 10000); 
        }
    },

    startVoice: (elementId) => {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-IN';
        recognition.onresult = (e) => {
            if ($(elementId)) $(elementId).value += ( $(elementId).value ? ' ' : '' ) + e.results[0][0].transcript;
        };
        recognition.start();
    },

    generateOutput: async () => {
        const rawData = $('rawInput').value.trim();
        const apiKey = $('apiKey').value.trim();
        const workDate = $('workDate').value; 
        const btn = $('generateBtn');

        if (!apiKey) return UI.openModal('settingsModal');
        if (!rawData) return alert("Please dump some notes first.");

        btn.innerText = "Structuring Data...";
        btn.disabled = true;

        // FIXED: Using Back-ticks properly
        const prompt = `You are an elite Corporate Work Analyst and Project Manager. 
        Your job is to process the following raw IT employee input through a strict 4-STEP INTERNAL PIPELINE.

        Raw Input: "${rawData}"

        --- INTERNAL PIPELINE ---
        STEP 1 - TASK EXTRACTION: Identify every single atomic task. Do NOT drop any information.
        STEP 2 - SMART STRUCTURING (FOR SCRUM): Group into concise "YESTERDAY" and "TODAY" (max 3 points each).
        STEP 3 - TIMESHEET GENERATION: Allocate hours totaling EXACTLY 8.0 (or user-specified total).
        STEP 4 - VALIDATION: Ensure 100% data presence and correct total hours.

        --- STRICT OUTPUT FORMAT ---
        ===MOTIVATION===
        [1 short empowering sentence]
        ===YESTERDAY===
        [Concise bullet points]
        ===TODAY===
        [Concise bullet points]
        ===BLOCKERS===
        [Identified blockers or 'None']
        ===TIMESHEET===
        Project,Task Description,Hours
        [CSV rows]
        Total,,[Total]`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || "API Error");

            const aiOutput = data.candidates[0].content.parts[0].text;
            const extract = (t1, t2) => { try { return aiOutput.split(t1)[1].split(t2)[0].trim(); } catch(e) { return ""; } };

            const mot = extract('===MOTIVATION===', '===YESTERDAY===');
            const yest = extract('===YESTERDAY===', '===TODAY===');
            const tod = extract('===TODAY===', '===BLOCKERS===');
            const block = extract('===BLOCKERS===', '===TIMESHEET===');
            const ts = aiOutput.split('===TIMESHEET===')[1]?.trim() || "";

            if($('aiMotivation')) $('aiMotivation').innerText = mot;
            if($('outYesterday')) $('outYesterday').innerText = yest;
            if($('outToday')) $('outToday').innerText = tod;
            if($('outBlockers')) $('outBlockers').innerText = block;
            
            Engine.renderEditableTable(ts);
            Archive.save(workDate, yest, tod, block, ts); 
            $('rawInput').value = '';
            localStorage.removeItem('draft_rawInput');
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.innerText = "✨ Auto-Structure with AI";
            btn.disabled = false;
        }
    },

    renderEditableTable: (csvString) => {
        const rows = csvString.split('\n');
        if (rows.length < 2) return;
        let html = '<table class="ts-table" id="exportableTable"><thead><tr>';
        rows[0].split(',').forEach(h => html += `<th>${h.trim()}</th>`);
        html += '</tr></thead><tbody>';
        for(let i=1; i<rows.length; i++) {
            if(!rows[i].trim()) continue;
            html += '<tr>';
            rows[i].split(',').forEach(c => html += `<td contenteditable="true">${c.trim()}</td>`);
            html += '</tr>';
        }
        html += '</tbody></table>';
        if ($('tsTableContainer')) $('tsTableContainer').innerHTML = html;
    }
};

// ==========================================
// 4. ARCHIVE MODULE (RESTORED MISSING LOGIC)
// ==========================================
const Archive = {
    currentTab: 'history',
    currentFilter: 'all',

    save: (dateStr, y, t, b, ts) => {
        sanraiData.history.unshift({ id: Date.now(), date: dateStr, timestamp: Date.now(), yesterday: y, today: t, blockers: b, timesheetCSV: ts });
        sanraiData.history.sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
    },

    switchTab: (tab, btnElement) => {
        document.querySelectorAll('#historyModal .tab-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        Archive.currentTab = tab;
        Archive.renderList();
    },

    renderList: () => {
        const list = $('historyList');
        if (!list) return;
        list.innerHTML = '';
        let targetData = Archive.currentTab === 'history' ? sanraiData.history : sanraiData.bin;
        
        const query = $('universalSearch') ? $('universalSearch').value.toLowerCase() : '';
        if (query) {
            targetData = targetData.filter(item => `${item.date} ${item.yesterday}`.toLowerCase().includes(query));
        }

        if (targetData.length === 0) {
            list.innerHTML = `<p class="hint-text">No records found.</p>`;
            return;
        }

        targetData.forEach(item => {
            list.innerHTML += `
                <div class="history-item">
                    <div class="history-date"><span>Work Date: ${item.date}</span></div>
                    <div class="history-view-content">
                        <b>Yesterday:</b> ${item.yesterday}<br>
                        <b>Today:</b> ${item.today}
                    </div>
                    <div class="history-actions no-print">
                        ${Archive.currentTab === 'history' 
                            ? `<button class="action-btn" onclick="Archive.moveToBin(${item.id})">🗑️ Delete</button>`
                            : `<button class="action-btn" onclick="Archive.restore(${item.id})">♻️ Restore</button>`}
                    </div>
                </div>
            `;
        });
    },

    moveToBin: (id) => {
        const idx = sanraiData.history.findIndex(i => i.id === id);
        if(idx > -1) {
            const item = sanraiData.history.splice(idx, 1)[0];
            item.deleteDate = Date.now();
            sanraiData.bin.unshift(item);
            localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
            Archive.renderList();
        }
    },

    restore: (id) => {
        const idx = sanraiData.bin.findIndex(i => i.id === id);
        if(idx > -1) {
            const item = sanraiData.bin.splice(idx, 1)[0];
            delete item.deleteDate; 
            sanraiData.history.unshift(item);
            localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
            Archive.renderList();
        }
    },

    cleanBin: () => {
        const now = Date.now();
        sanraiData.bin = sanraiData.bin.filter(item => (now - item.deleteDate) < (90 * 86400000));
        localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
    }
};

window.onload = App.init;
