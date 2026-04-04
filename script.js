let sanraiData = JSON.parse(localStorage.getItem('sanraiData')) || { history: [], bin: [] };

// ==========================================
// 1. APP & NOTIFICATIONS
// ==========================================
const App = {
    init: () => {
        const hasConsent = localStorage.getItem('sanrai_consent');
        if (!hasConsent) {
            document.getElementById('consentOverlay').style.display = 'flex';
            document.body.classList.add('no-scroll');
        } else if (!localStorage.getItem('sanrai_apiKey')) {
            App.startTour();
        }

        const savedKey = localStorage.getItem('sanrai_apiKey');
        if (savedKey) document.getElementById('apiKey').value = savedKey;
        
        const savedTime1 = localStorage.getItem('sanrai_notifTime1');
        if(savedTime1) document.getElementById('notifTime1').value = savedTime1;
        const savedTime2 = localStorage.getItem('sanrai_notifTime2');
        if(savedTime2) document.getElementById('notifTime2').value = savedTime2;

        const draft = localStorage.getItem('draft_rawInput');
        if (draft) document.getElementById('rawInput').value = draft;

        document.getElementById('workDate').valueAsDate = new Date(); 

        document.getElementById('rawInput').addEventListener('input', (e) => {
            localStorage.setItem('draft_rawInput', e.target.value);
        });

        Archive.cleanBin();
        Engine.initNotifications();
    },

    acceptConsent: () => {
        localStorage.setItem('sanrai_consent', 'true');
        document.getElementById('consentOverlay').style.display = 'none';
        document.body.classList.remove('no-scroll');
        App.startTour();
    },

    saveSettings: () => {
        localStorage.setItem('sanrai_apiKey', document.getElementById('apiKey').value);
        localStorage.setItem('sanrai_notifTime1', document.getElementById('notifTime1').value);
        localStorage.setItem('sanrai_notifTime2', document.getElementById('notifTime2').value);
        UI.closeModal('settingsModal');
        Engine.initNotifications(); 
    },

    tourStep: 1,
    startTour: () => {
        UI.closeModal('settingsModal');
        document.getElementById('tourOverlay').style.display = 'flex';
        document.body.classList.add('no-scroll');
        App.tourStep = 1;
        App.renderTourStep();
    },
    renderTourStep: () => {
        const content = document.getElementById('tourContent');
        if (App.tourStep === 1) {
            content.innerHTML = `<h2 class="accent-text mb-15">1. Brain Dump & Dates</h2>
                <p class="small-text mb-15">Dump your notes in bad English. If you are logging for a previous day, just change the Date picker at the top.</p>
                <button class="primary-btn mt-20" onclick="App.tourStep++; App.renderTourStep()">Next</button>`;
        } else if (App.tourStep === 2) {
            content.innerHTML = `<h2 class="accent-text mb-15">2. Clarity & Focus</h2>
                <p class="small-text mb-15">AI organizes your mess into clear Yesterday, Today, and Blocker sections for your Scrum calls, plus an editable 8-hour Timesheet.</p>
                <button class="primary-btn mt-20" onclick="App.tourStep++; App.renderTourStep()">Next</button>`;
        } else if (App.tourStep === 3) {
            content.innerHTML = `<h2 class="accent-text mb-15">3. Two Daily Reminders</h2>
                <p class="small-text mb-15">Set Morning and Evening Scrum reminder times in Settings. We will ping you to prep your notes!</p>
                <button class="primary-btn mt-20" onclick="App.finishTour()">Get Started</button>`;
        }
    },
    finishTour: () => {
        document.getElementById('tourOverlay').style.display = 'none';
        document.body.classList.remove('no-scroll');
        if (!localStorage.getItem('sanrai_apiKey')) UI.openModal('settingsModal');
    }
};

// ==========================================
// 2. UI MODULE (SCROLL BUG FIXED & TABS)
// ==========================================
const UI = {
    openModal: (id) => {
        document.getElementById(id).style.display = 'flex';
        document.body.classList.add('no-scroll');
    },
    closeModal: (id) => {
        document.getElementById(id).style.display = 'none';
        document.body.classList.remove('no-scroll');
    },
    
    switchOutputTab: (tab, btnElement) => {
        document.querySelectorAll('.output-panel .tab-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        document.getElementById('scrumView').style.display = tab === 'scrum' ? 'block' : 'none';
        document.getElementById('timesheetView').style.display = tab === 'timesheet' ? 'block' : 'none';
    },
    
    copyScrum: () => {
        const y = document.getElementById('outYesterday').innerText;
        const t = document.getElementById('outToday').innerText;
        const b = document.getElementById('outBlockers').innerText;
        const text = `Yesterday: ${y}\nToday: ${t}\nBlockers: ${b}`;
        navigator.clipboard.writeText(text).then(() => alert("Scrum notes copied!"));
    },

    togglePassword: () => {
        const input = document.getElementById('apiKey');
        input.type = input.type === 'password' ? 'text' : 'password';
    },

    openArchive: () => {
        UI.openModal('historyModal');
        document.getElementById('universalSearch').value = ''; 
        const historyBtn = document.getElementById('historyTabBtn');
        if(historyBtn) Archive.switchTab('history', historyBtn);
    }
};

// ==========================================
// 3. ENGINE MODULE
// ==========================================
const Engine = {
    notifInterval: null,
    
    initNotifications: () => {
        const btn = document.getElementById('notifBtn');
        if (Notification.permission === 'granted') {
            btn.innerText = '🔔 Alerts: On';
            btn.style.color = 'var(--accent)';
            
            if(Engine.notifInterval) clearInterval(Engine.notifInterval);
            Engine.notifInterval = setInterval(() => {
                const time1 = localStorage.getItem('sanrai_notifTime1') || "09:00";
                const time2 = localStorage.getItem('sanrai_notifTime2') || "17:00";
                const now = new Date();
                const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
                
                if((currentTime === time1 || currentTime === time2) && now.getSeconds() < 10) { 
                    new Notification("SANRAI Alert", { body: "Time to prep your Scrum notes! Open SANRAI.", icon: "https://uploads.onecompiler.io/44hamhdu3/44j87h6rm/1000074177.webp" });
                }
            }, 10000); 
        }
    },

    toggleNotifications: () => {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') Engine.initNotifications();
        });
    },

    startVoice: (elementId) => {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-IN';
        const btn = document.querySelector('.mic-btn');
        btn.style.background = 'var(--accent)';
        
        recognition.onresult = (e) => {
            document.getElementById(elementId).value += (document.getElementById(elementId).value ? ' \n' : '') + e.results[0][0].transcript;
            btn.style.background = 'var(--bg-panel)';
        };
        recognition.onerror = () => btn.style.background = 'var(--bg-panel)';
        recognition.start();
    },

    generateOutput: async () => {
        const rawData = document.getElementById('rawInput').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();
        const workDate = document.getElementById('workDate').value; 
        const btn = document.getElementById('generateBtn');

        if (!apiKey) return UI.openModal('settingsModal');
        if (!rawData) return alert("Please dump some notes first.");

        btn.innerText = "Structuring Data...";
        btn.disabled = true;

        const prompt = `Convert this raw IT employee input into structured output.
        Raw Input: "${rawData}"

        Strict Output Format (Use exactly these delimiters):
        ===MOTIVATION===
        [1 short empowering sentence for an IT worker]
        ===YESTERDAY===
        [Bullet points of completed tasks]
        ===TODAY===
        [Bullet points of next logical focus areas]
        ===BLOCKERS===
        [Identified blockers, or 'None']
        ===TIMESHEET===
        Project,Task Description,Hours
        [Generate rows based on tasks totaling 8 or more hours]
        Total,,[Total Hours]`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            
            const data = await response.json();
            
            // --- KOTHA ERROR CHECKING CODE ---
            if (!response.ok) {
                alert("Google API Error: " + (data.error ? data.error.message : "Unknown Error"));
                btn.innerText = "✨ Auto-Structure with AI";
                btn.disabled = false;
                return; 
            }

            if (!data.candidates || !data.candidates[0].content) {
                 alert("Google AI Error: Response blocked due to safety or empty output.");
                 btn.innerText = "✨ Auto-Structure with AI";
                 btn.disabled = false;
                 return;
            }
            // ---------------------------------

            const aiOutput = data.candidates[0].content.parts[0].text;
            
            const extract = (tag1, tag2) => {
                try { return aiOutput.split(tag1)[1].split(tag2)[0].trim(); } catch(e) { return ""; }
            };

            const mot = extract('===MOTIVATION===', '===YESTERDAY===');
            const yest = extract('===YESTERDAY===', '===TODAY===');
            const tod = extract('===TODAY===', '===BLOCKERS===');
            const block = extract('===BLOCKERS===', '===TIMESHEET===');
            const ts = aiOutput.split('===TIMESHEET===')[1].trim();

            document.getElementById('aiMotivation').innerText = mot;
            document.getElementById('outYesterday').innerText = yest;
            document.getElementById('outToday').innerText = tod;
            document.getElementById('outBlockers').innerText = block;
            
            Engine.renderEditableTable(ts);
            Archive.save(workDate, yest, tod, block, ts); 

            document.getElementById('rawInput').value = '';
            localStorage.removeItem('draft_rawInput');

        } catch (error) {
            // Updated catch block to show exact network error
            alert("Network Error: " + error.message);
        } finally {
            btn.innerText = "✨ Auto-Structure with AI";
            btn.disabled = false;
        }
    },

    renderEditableTable: (csvString) => {
        const rows = csvString.split('\n');
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
        document.getElementById('tsTableContainer').innerHTML = html;
    },

    exportCSV: () => {
        const table = document.getElementById('exportableTable');
        if(!table) return alert("Generate data first!");
        
        let csv = [];
        const rows = table.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            let row = [], cols = rows[i].querySelectorAll('td, th');
            for (let j = 0; j < cols.length; j++) {
                let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ');
                row.push('"' + data.replace(/"/g, '""') + '"');
            }
            csv.push(row.join(','));
        }
        
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `SANRAI_Timesheet_${document.getElementById('workDate').value}.csv`;
        a.click();
    }
};

// ==========================================
// 4. ARCHIVE MODULE
// ==========================================
const Archive = {
    currentTab: 'history',
    currentFilter: 'all',
    searchQuery: '',

    save: (dateStr, y, t, b, ts) => {
        sanraiData.history.unshift({
            id: Date.now(),
            date: dateStr, 
            timestamp: Date.now(), 
            yesterday: y, today: t, blockers: b,
            timesheetCSV: ts 
        });
        sanraiData.history.sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
    },

    switchTab: (tab, btnElement) => {
        document.querySelectorAll('#historyModal .tab-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        Archive.currentTab = tab;
        document.getElementById('archiveFilters').style.display = tab === 'bin' ? 'none' : 'flex';
        Archive.renderList();
    },

    filter: (type) => { Archive.currentFilter = type; Archive.renderList(); },
    search: () => { Archive.searchQuery = document.getElementById('universalSearch').value.toLowerCase(); Archive.renderList(); },

    renderList: () => {
        const list = document.getElementById('historyList');
        list.innerHTML = '';
        
        let targetData = Archive.currentTab === 'history' ? sanraiData.history : sanraiData.bin;
        
        if (Archive.searchQuery) {
            targetData = targetData.filter(item => {
                const text = `${item.date} ${item.yesterday} ${item.today} ${item.timesheetCSV}`.toLowerCase();
                return text.includes(Archive.searchQuery);
            });
        }

        if (Archive.currentTab === 'history') {
            const todayStr = new Date().toISOString().split('T')[0];
            const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1);
            const yestStr = yestDate.toISOString().split('T')[0];
            
            targetData = targetData.filter(item => {
                if (Archive.currentFilter === 'today') return item.date === todayStr;
                if (Archive.currentFilter === 'yesterday') return item.date === yestStr;
                if (Archive.currentFilter === 'week') return (Date.now() - item.timestamp) <= (7 * 86400000);
                return true;
            });
        }

        if (targetData.length === 0) return list.innerHTML = `<p class="hint-text">No records found.</p>`;

        targetData.forEach(item => {
            const rows = item.timesheetCSV.split('\n');
            let tableHTML = '<table class="ts-table"><thead><tr>';
            rows[0].split(',').forEach(h => tableHTML += `<th>${h.trim()}</th>`);
            tableHTML += '</tr></thead><tbody>';
            for(let i=1; i<rows.length; i++) {
                if(!rows[i].trim()) continue;
                tableHTML += '<tr>';
                rows[i].split(',').forEach(c => tableHTML += `<td>${c.trim()}</td>`);
                tableHTML += '</tr>';
            }
            tableHTML += '</tbody></table>';

            let actionButtons = Archive.currentTab === 'history' 
                ? `<button class="action-btn" onclick="Archive.moveToBin(${item.id})">🗑️ Move to Bin</button>`
                : `<button class="action-btn" onclick="Archive.restore(${item.id})">♻️ Restore</button>
                   <button class="action-btn delete-btn" onclick="Archive.permanentlyDelete(${item.id})">❌ Wipe Data</button>`;

            list.innerHTML += `
                <div class="history-item">
                    <div class="history-date"><span>Work Date: ${item.date}</span></div>
                    <div class="history-view-content">
                        <b>Yesterday:</b><br> ${item.yesterday}<br><br>
                        <b>Today:</b><br> ${item.today}<br><br>
                        <b>Blockers:</b><br> ${item.blockers}
                        <br><br>${tableHTML}
                    </div>
                    <div class="history-actions no-print">${actionButtons}</div>
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
            sanraiData.history.sort((a, b) => new Date(b.date) - new Date(a.date));
            localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
            Archive.renderList();
        }
    },

    permanentlyDelete: (id) => {
        if(confirm("Wipe this record? It cannot be recovered.")) {
            sanraiData.bin = sanraiData.bin.filter(i => i.id !== id);
            localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
            Archive.renderList();
        }
    },

    cleanBin: () => {
        const now = Date.now();
        sanraiData.bin = sanraiData.bin.filter(item => (now - item.deleteDate) < (90 * 86400000));
        localStorage.setItem('sanraiData', JSON.stringify(sanraiData));
    },

    downloadPDF: () => window.print()
};

window.onload = App.init;
