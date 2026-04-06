let sanraiData = JSON.parse(localStorage.getItem('sanraiData')) || { history: [], bin: [] };

const $ = (id) => document.getElementById(id);

// --- GLOBAL HARDWARE INTEGRATIONS ---
document.body.addEventListener('click', (e) => {
    if(e.target.closest('.haptic-btn') && navigator.vibrate) {
        navigator.vibrate(30);
    }
});

window.addEventListener('popstate', (e) => {
    document.querySelectorAll('.modal, .overlay').forEach(m => {
        if(m.id !== 'consentOverlay' && m.id !== 'tourOverlay') m.style.display = 'none';
    });
    document.body.classList.remove('no-scroll');
    if(e.state && e.state.modal) {
         $(e.state.modal).style.display = 'flex';
         document.body.classList.add('no-scroll');
    }
});

// ==========================================
// 1. APP & INITIALIZATION
// ==========================================
const App = {
    init: () => {
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
            content.innerHTML = `<h2 class="accent-text mb-15">1. The Brain Dump</h2>
                <div style="font-size: 3rem; margin: 20px 0;">🗣️ ➡️ 💻</div>
                <p class="small-text mb-15">Type or speak your messy, chaotic work notes. Don't worry about grammar.</p>
                <button class="primary-btn haptic-btn mt-20" onclick="App.tourStep++; App.renderTourStep()">Next ➡️</button>`;
        } else if (App.tourStep === 2) {
            content.innerHTML = `<h2 class="accent-text mb-15">2. Click Generate</h2>
                <div style="font-size: 3rem; margin: 20px 0;">✨ ⚙️ 📄</div>
                <p class="small-text mb-15">Our AI translates your raw thoughts into a professional Scrum update.</p>
                <button class="primary-btn haptic-btn mt-20" onclick="App.tourStep++; App.renderTourStep()">Next ➡️</button>`;
        } else if (App.tourStep === 3) {
            content.innerHTML = `<h2 class="accent-text mb-15">3. Speak Clearly</h2>
                <div style="font-size: 3rem; margin: 20px 0;">😎 🚀 📈</div>
                <p class="small-text mb-15">Copy your update, speak with confidence, and never fear Stand-ups again!</p>
                <button class="primary-btn haptic-btn mt-20" onclick="App.finishTour()">Let's Go!</button>`;
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
    openModal: (id) => { 
        if ($(id)) { 
            $(id).style.display = 'flex'; 
            document.body.classList.add('no-scroll');
            history.pushState({ modal: id }, "", "#" + id); 
        } 
    },
    closeModal: (id) => { 
        if ($(id)) { 
            $(id).style.display = 'none'; 
            document.body.classList.remove('no-scroll'); 
            if (history.state && history.state.modal === id) history.back();
        } 
    },
    
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
        Archive.filter('all'); 
    }
};

// ==========================================
// 3. ENGINE MODULE
// ==========================================
const Engine = {
    notifInterval: null,
    mediaRecorderInstance: null,
    audioChunks: [],
    
    toggleNotifications: () => {
        if (!("Notification" in window)) return alert("Your browser doesn't support notifications.");
        
        if (Notification.permission === "granted") {
            alert("Alerts are already active! You will be notified at your set times.");
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    Engine.initNotifications();
                } else {
                    alert("Notification permission denied.");
                }
            });
        }
    },

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
                    new Notification("SANRAI Alert", { body: "Time to prep your Scrum notes!", icon: "logo.png" });
                }
            }, 10000); 
        }
    },

    startVoice: async (elementId) => {
        const micBtn = $('micButton');
        const apiKey = $('apiKey').value.trim();

        if (!apiKey) {
            UI.openModal('settingsModal');
            return alert("Please enter your Gemini API Key in settings to use the Voice feature.");
        }

        if (Engine.mediaRecorderInstance && Engine.mediaRecorderInstance.state === "recording") {
            Engine.mediaRecorderInstance.stop();
            micBtn.classList.remove('recording');
            micBtn.innerText = "⏳"; 
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            Engine.mediaRecorderInstance = new MediaRecorder(stream);
            Engine.audioChunks = [];

            Engine.mediaRecorderInstance.ondataavailable = event => {
                if (event.data.size > 0) {
                    Engine.audioChunks.push(event.data);
                }
            };

            Engine.mediaRecorderInstance.onstop = async () => {
                if (Engine.audioChunks.length === 0) {
                    micBtn.innerText = "🎙️";
                    return alert("Recording was empty. Please try speaking again.");
                }

                let mimeType = Engine.mediaRecorderInstance.mimeType || 'audio/webm';
                mimeType = mimeType.split(';')[0]; 

                const audioBlob = new Blob(Engine.audioChunks, { type: mimeType });
                
                if (audioBlob.size < 500) {
                    micBtn.innerText = "🎙️";
                    return alert("Recording was too short. Please speak a bit longer.");
                }

                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result.split(',')[1];
                    
                    // FIX: Strict Anti-Hallucination Prompt
                    const aiPrompt = `Listen to this audio. It can be in ANY language in the world, or a mix of multiple languages. Transcribe exactly what is spoken. 
CRITICAL INSTRUCTION: If the audio is completely silent, only contains background static/noise, or has no human voice speaking, you MUST output exactly and ONLY the word 'SILENCE_DETECTED'. Do not hallucinate, guess, or invent news, ads, or random text under any circumstances. Just return 'SILENCE_DETECTED'.`;

                    try {
                        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: aiPrompt },
                                        { inlineData: { mimeType: mimeType, data: base64Audio } }
                                    ]
                                }]
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (!response.ok || data.error) {
                            throw new Error(data.error?.message || "Google API Failed to process audio.");
                        }

                        if (data.candidates && data.candidates[0] && data.candidates[0].content.parts[0]) {
                            const transcript = data.candidates[0].content.parts[0].text.trim();
                            
                            // FIX: Checking for the silence flag
                            if (transcript.includes("SILENCE_DETECTED")) {
                                alert("No speech detected. Please speak clearly into the microphone.");
                            } else {
                                $(elementId).value += ($(elementId).value ? ' ' : '') + transcript;
                            }

                        } else {
                            alert("AI could not understand the audio. Please try speaking clearly.");
                        }
                    } catch (err) {
                        alert("API Error: " + err.message);
                    } finally {
                        micBtn.innerText = "🎙️"; 
                    }
                };
                
                stream.getTracks().forEach(track => track.stop());
            };

            Engine.mediaRecorderInstance.start();
            micBtn.classList.add('recording');
            micBtn.innerText = "⏹️"; 

        } catch (err) {
            alert("Microphone access denied. Please allow microphone permissions in your browser settings.");
            console.error("Mic error:", err);
        }
    },

    exportCSV: () => {
        const table = $('exportableTable');
        if(!table) return alert("No timesheet generated yet.");
        let csv = [];
        let rows = table.querySelectorAll("tr");
        for(let i=0; i<rows.length; i++) {
            let row = [], cols = rows[i].querySelectorAll("td, th");
            for(let j=0; j<cols.length; j++) row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
            csv.push(row.join(","));
        }
        const blob = new Blob([csv.join("\n")], {type: "text/csv"});
        const a = document.createElement("a");
        a.href = window.URL.createObjectURL(blob);
        a.download = "Sanrai_Timesheet.csv";
        a.click();
    },

    generateOutput: async () => {
        const rawData = $('rawInput').value.trim();
        const apiKey = $('apiKey').value.trim();
        const workDate = $('workDate').value; 
        const btn = $('generateBtn');

        if (!apiKey) return UI.openModal('settingsModal');
        if (!rawData) return alert("Please dump some notes first.");

        btn.disabled = true;
        let step = 0;
        const thinkingPhrases = ["Reading your chaos...", "Translating to Corporate...", "Building Timesheet...", "Finalizing..."];
        const thinkInterval = setInterval(() => {
            btn.innerText = thinkingPhrases[step % thinkingPhrases.length];
            step++;
        }, 1500);

        const prompt = `You are an insightful Technical Lead and Agile Coach. 
        Your job is to process the following raw IT employee input through a strict 4-STEP INTERNAL PIPELINE.

        Raw Input: "${rawData}"

        --- TONE & STYLE GUIDELINES (CRITICAL) ---
        Translate the input into professional but NATURAL, simple corporate English. 
        AVOID overly complex corporate jargon, robotic AI buzzwords, or highly senior architectural terms. 
        Write it exactly how a sensible junior or mid-level developer would naturally speak in a daily stand-up—clear, confident, to the point, but realistic.

        --- INTERNAL PIPELINE ---
        STEP 1 - TASK EXTRACTION: Identify every single atomic task. Do NOT drop any information.
        STEP 2 - SMART STRUCTURING (FOR SCRUM): Group into concise "YESTERDAY" and "TODAY" (max 3 points each). Keep sentences straightforward.
        STEP 3 - TIMESHEET GENERATION: Allocate hours totaling EXACTLY 8.0 (or user-specified total).
        STEP 4 - VALIDATION: Ensure 100% data presence and correct total hours.

        --- STRICT OUTPUT FORMAT ---
        ===MOTIVATION===
        [1 short empowering sentence]
        ===YESTERDAY===
        [Concise bullet points in a natural professional tone]
        ===TODAY===
        [Concise bullet points in a natural professional tone]
        ===BLOCKERS===
        [Identified blockers or 'None' in plain English]
        ===TIMESHEET===
        Project,Task Description,Hours
        [CSV rows]
        Total,,[Total]`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
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
            
            if(navigator.vibrate) navigator.vibrate([50, 50, 100]);

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            clearInterval(thinkInterval);
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
// 4. ARCHIVE MODULE
// ==========================================
const Archive = {
    currentTab: 'history',
    currentFilter: 'all',

    search: () => Archive.renderList(),
    downloadPDF: () => window.print(),

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

    filter: (range) => {
        Archive.currentFilter = range;
        const filterBtns = document.querySelectorAll('#archiveFilters .secondary-btn');
        filterBtns.forEach(btn => {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-primary)';
            if(btn.innerText.toLowerCase() === range.toLowerCase()) {
                btn.style.background = 'var(--accent)';
                btn.style.color = '#0f172a';
            }
        });
        Archive.renderList();
    },

    renderList: () => {
        const list = $('historyList');
        if (!list) return;
        list.innerHTML = '';
        let targetData = Archive.currentTab === 'history' ? sanraiData.history : sanraiData.bin;
        
        const query = $('universalSearch') ? $('universalSearch').value.toLowerCase() : '';
        if (query) {
            targetData = targetData.filter(item => 
                `${item.date} ${item.yesterday} ${item.today} ${item.blockers}`.toLowerCase().includes(query)
            );
        }

        if (Archive.currentFilter !== 'all') {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            targetData = targetData.filter(item => {
                const itemDate = new Date(item.date);
                itemDate.setHours(0,0,0,0);
                const diffTime = Math.abs(today - itemDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (Archive.currentFilter === 'today') return diffDays === 0;
                if (Archive.currentFilter === 'yesterday') return diffDays === 1;
                if (Archive.currentFilter === 'week') return diffDays <= 7;
                return true;
            });
        }

        if (targetData.length === 0) {
            list.innerHTML = `<p class="hint-text" style="text-align:center; margin-top:20px;">No records found.</p>`;
            return;
        }

        targetData.forEach(item => {
            list.innerHTML += `
                <div class="history-item">
                    <div class="history-date"><span>Work Date: ${item.date}</span></div>
                    <div class="history-view-content">
                        <b>Yesterday:</b> ${item.yesterday}<br>
                        <b>Today:</b> ${item.today}<br>
                        ${item.blockers && item.blockers !== 'None' ? `<b style="color:var(--danger)">Blockers:</b> ${item.blockers}` : ''}
                    </div>
                    <div class="history-actions no-print">
                        ${Archive.currentTab === 'history' 
                            ? `<button class="action-btn haptic-btn" onclick="Archive.moveToBin(${item.id})">🗑️ Delete</button>`
                            : `<button class="action-btn haptic-btn" onclick="Archive.restore(${item.id})">♻️ Restore</button>`}
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
