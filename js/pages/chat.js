/* PAGE: CHAT — Cloud & Local Persistent Messaging with Supabase sync */
const PageChat = (() => {
    let _pollTimer = null;
    let _typingTimer = null;
    let activeRoomIdx = 0;
    let lastRenderedHash = '';
    let rooms = [];
    let state = null;
    let email = '';
    let emailClean = '';

    function buildRoomId(a, b) {
        const cleanA = (a || '').toLowerCase().trim();
        const cleanB = (b || '').toLowerCase().trim();
        const sorted = [cleanA, cleanB].sort().join('||');
        let h = 0;
        for (let i = 0; i < sorted.length; i++) { h = ((h << 5) - h + sorted.charCodeAt(i)) | 0; }
        return `direct::${(h >>> 0).toString(16)}`;
    }

    function getStoredMessages() {
        try {
            return JSON.parse(localStorage.getItem('nebula_chat_store_v2') || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveStoredMessages(msgs) {
        try {
            localStorage.setItem('nebula_chat_store_v2', JSON.stringify(msgs.slice(-1000)));
        } catch (e) {
            console.warn('[ChatStore] Erro ao salvar cache:', e);
        }
    }

    function collectPeersFromMessages(stateObj, myEmailClean) {
        const peers = new Map();
        const sources = [
            ...(stateObj.community_messages || []),
            ...getStoredMessages()
        ];
        sources.forEach(m => {
            if (!m) return;
            const sender = (m.sender_email || '').toLowerCase().trim();
            const recipient = (m.recipient_email || '').toLowerCase().trim();
            if (sender === myEmailClean && recipient && recipient !== 'ai') {
                peers.set(recipient, m.sender_name || recipient);
            } else if (recipient === myEmailClean && sender && sender !== 'ai@nebula' && sender !== 'ai') {
                peers.set(sender, m.sender_name || sender);
            }
        });
        return peers;
    }

    function getAvailableRooms(stateObj, userEmail) {
        const list = [
            { id: 'ai::llama33', label: 'Llama 3.3 (Assistente IA)', peer: 'ai', kind: 'ai' }
        ];

        const myEmailClean = (userEmail || '').toLowerCase().trim();
        const knownPeers = new Map();

        Object.entries(stateObj.users || {}).forEach(([pEmail, pObj]) => {
            const cleanP = (pEmail || '').toLowerCase().trim();
            if (cleanP !== myEmailClean && !cleanP.startsWith('demo_') && pObj) {
                knownPeers.set(cleanP, {
                    name: pObj.name || pEmail,
                    email: pEmail,
                    shared_topics: ['Pesquisa Científica'],
                    similarity: 0
                });
            }
        });

        const conns = getConnectedUsers(stateObj, userEmail, 50);
        conns.forEach(c => {
            const cleanC = (c.email || '').toLowerCase().trim();
            if (cleanC !== myEmailClean) {
                knownPeers.set(cleanC, {
                    name: c.name || c.email,
                    email: c.email,
                    shared_topics: c.shared_topics || ['Pesquisa Científica'],
                    similarity: c.similarity || 0
                });
            }
        });

        collectPeersFromMessages(stateObj, myEmailClean).forEach((name, peerEmail) => {
            if (!knownPeers.has(peerEmail)) {
                const userKey = NebulaStorage.findUserKey(stateObj, peerEmail);
                const userObj = userKey ? stateObj.users[userKey] : null;
                knownPeers.set(peerEmail, {
                    name: userObj?.name || name || peerEmail,
                    email: userKey || peerEmail,
                    shared_topics: ['Pesquisa Científica'],
                    similarity: 0
                });
            }
        });

        const sortedPeers = Array.from(knownPeers.values()).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

        sortedPeers.forEach(peerData => {
            const peerEmail = peerData.email;
            list.push({
                id: buildRoomId(myEmailClean, peerEmail),
                label: peerData.name,
                peer: peerEmail,
                kind: 'direct',
                shared_topics: peerData.shared_topics,
                similarity: peerData.similarity || 0,
            });
        });

        return list;
    }

    async function sendMessage(msgObj) {
        const isAi = msgObj.room_id?.startsWith('ai::') || msgObj.recipient_email === 'ai' || msgObj.sender_email === 'ai@nebula';
        const senderEmail = (msgObj.sender_email || '').toLowerCase().trim();
        const recipientEmail = (msgObj.recipient_email || '').toLowerCase().trim();
        const roomId = isAi ? (msgObj.room_id || 'ai::llama33') : buildRoomId(senderEmail, recipientEmail);

        msgObj.room_id = roomId;
        msgObj.sender_email = senderEmail;
        msgObj.recipient_email = recipientEmail;

        const localStore = getStoredMessages();
        if (!localStore.some(m => m.id === msgObj.id)) {
            localStore.push(msgObj);
            saveStoredMessages(localStore);
        }

        if (!state.community_messages) state.community_messages = [];
        if (!state.community_messages.some(m => m.id === msgObj.id)) {
            state.community_messages.push(msgObj);
        }
        NebulaStorage.saveState(state);

        if (!isAi) {
            fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msgObj })
            }).catch(e => console.warn('[Chat] API POST error:', e));

            NebulaStorage.saveMessageToSupabase(msgObj).catch(e => console.warn('[Chat] Supabase save error:', e));
            NebulaStorage.saveStateAsync(state).catch(e => console.warn('[Chat] State sync error:', e));
        }
    }

    async function getRoomMessages(roomId, myEmail, peerEmail) {
        const isAi = roomId.startsWith('ai::') || peerEmail === 'ai';
        const cleanMine = (myEmail || '').toLowerCase().trim();
        const cleanPeer = (peerEmail || '').toLowerCase().trim();
        const targetRoomId = isAi ? roomId : buildRoomId(cleanMine, cleanPeer);

        let allMsgs = [];

        const localStore = getStoredMessages();
        const matchedLocal = localStore.filter(m =>
            m.room_id === targetRoomId ||
            (isAi && (m.room_id?.startsWith('ai::') || m.sender_email === 'ai@nebula')) ||
            (!isAi && (
                (m.sender_email?.toLowerCase() === cleanPeer && m.recipient_email?.toLowerCase() === cleanMine) ||
                (m.sender_email?.toLowerCase() === cleanMine && m.recipient_email?.toLowerCase() === cleanPeer)
            ))
        );
        allMsgs.push(...matchedLocal);

        if (state.community_messages) {
            const fromState = state.community_messages.filter(m =>
                m.room_id === targetRoomId ||
                (!isAi && (
                    (m.sender_email?.toLowerCase() === cleanPeer && m.recipient_email?.toLowerCase() === cleanMine) ||
                    (m.sender_email?.toLowerCase() === cleanMine && m.recipient_email?.toLowerCase() === cleanPeer)
                ))
            );
            allMsgs.push(...fromState);
        }

        if (!isAi) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 2500);
                const res = await fetch(`/api/messages?roomId=${encodeURIComponent(targetRoomId)}`, { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.messages?.length) allMsgs.push(...data.messages);
                }
            } catch (e) {}

            try {
                const cloudMsgs = await NebulaStorage.fetchMessagesFromSupabase(targetRoomId, cleanMine);
                allMsgs.push(...cloudMsgs);
            } catch (e) {}
        }

        const uniqueMap = new Map();
        allMsgs.forEach(m => {
            if (!m) return;
            const key = m.id || `${m.timestamp}_${(m.sender_email || '').toLowerCase()}_${(m.text || '').slice(0, 20)}`;
            uniqueMap.set(key, m);
        });

        return Array.from(uniqueMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }

    function getPeerPhoto(peerEmail) {
        return NebulaStorage.getUserPhoto(state, peerEmail);
    }

    function getStatusLabel(room) {
        if (room.kind === 'ai') return 'Llama 3.3 (Assistente IA)';
        const sim = room.similarity || 0;
        const viewed = NebulaStorage.hasViewedProfile(state, emailClean, room.peer);
        const parts = [];
        if (viewed) parts.push('Visualizado');
        if (sim > 0) parts.push(`${sim}% afinidade`);
        return parts.length ? parts.join(' · ') : 'Pesquisador';
    }

    function renderRoomsList() {
        const listEl = document.getElementById('chat-rooms-list');
        if (!listEl) return;

        listEl.innerHTML = rooms.map((r, i) => {
            const isActive = i === activeRoomIdx;
            let avatarHtml = '';
            const subtitle = getStatusLabel(r);

            if (r.kind === 'ai') {
                avatarHtml = `<div class="chat-list-item-avatar bot">IA</div>`;
            } else {
                const photo = getPeerPhoto(r.peer);
                const initial = (r.label || '?').trim().charAt(0).toUpperCase();
                avatarHtml = `<div class="chat-list-item-avatar">${photo ? `<img src="${photo}" alt="">` : initial}</div>`;
            }

            return `
                <button type="button" class="chat-list-item ${isActive ? 'active' : ''}" onclick="PageChat.selectRoom(${i})">
                    ${avatarHtml}
                    <div class="chat-list-item-details" style="flex:1; min-width:0;">
                        <div class="chat-list-item-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.label}</div>
                        <div class="chat-list-item-subtitle">${subtitle}</div>
                    </div>
                </button>`;
        }).join('');
    }

    function renderHeader(room) {
        const activeHeader = document.getElementById('chat-active-header');
        if (!activeHeader || !room) return;

        let avatarHtml = '';
        let subtitleHtml = '';

        if (room.kind === 'ai') {
            avatarHtml = `<div class="chat-header-avatar bot">IA</div>`;
            subtitleHtml = `<span style="font-size:0.8rem;color:var(--text-white-60);">Llama 3.3 70B — Inteligência Artificial para Metodologia e Escrita</span>`;
        } else {
            const photo = getPeerPhoto(room.peer);
            const initial = (room.label || '?').trim().charAt(0).toUpperCase();
            avatarHtml = `<div class="chat-header-avatar user" style="cursor:pointer;" onclick="PageProfile.render(document.getElementById('pageContainer'), NebulaApp.getState(), '${room.peer}')">${photo ? `<img src="${photo}" alt="">` : initial}</div>`;
            const sim = room.similarity || 0;
            const viewed = NebulaStorage.hasViewedProfile(state, emailClean, room.peer);
            const topics = room.shared_topics?.length ? room.shared_topics.slice(0, 3).join(', ') : 'Pesquisa Científica';
            subtitleHtml =
                (viewed ? `<span style="font-size:0.8rem;color:#10b981;font-weight:600;margin-right:8px;">✓ Visualizado</span>` : '') +
                (sim > 0 ? `<span style="font-size:0.8rem;color:var(--color-blue);font-weight:600;margin-right:8px;">${sim}% afinidade</span>` : '') +
                `<span style="font-size:0.8rem;color:var(--text-white-60);">• ${topics}</span>` +
                `<button class="btn btn-sm" style="margin-left:auto; padding:2px 8px; font-size:0.75rem;" onclick="PageProfile.render(document.getElementById('pageContainer'), NebulaApp.getState(), '${room.peer}')">Ver Perfil</button>`;
        }

        activeHeader.innerHTML = `
            ${avatarHtml}
            <div style="flex:1;text-align:left;">
                <div style="font-weight:700;font-size:1.05rem;color:var(--text-white);">${room.label}</div>
                <div style="display:flex;align-items:center;margin-top:0.15rem;gap:4px;flex-wrap:wrap;">${subtitleHtml}</div>
            </div>`;
    }

    function renderTypingIndicator(room) {
        const statusEl = document.getElementById('chat-status');
        if (!statusEl || room.kind === 'ai') return;
        const typingPeers = NebulaStorage.getTypingPeers(room.id, emailClean);
        if (typingPeers.length) {
            const peerEmail = typingPeers[0];
            const userKey = NebulaStorage.findUserKey(state, peerEmail);
            const name = userKey ? (state.users[userKey]?.name || room.label) : room.label;
            statusEl.innerHTML = `<span class="chat-typing-indicator"><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span> ${name.split(' ')[0]} está digitando...</span>`;
        } else {
            statusEl.textContent = '';
        }
    }

    function selectRoom(i) {
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        activeRoomIdx = i;
        lastRenderedHash = '';
        renderRoomsList();
        const room = rooms[activeRoomIdx];
        if (!room) return;
        renderHeader(room);

        const msgContainer = document.getElementById('chat-messages-container');
        if (msgContainer) msgContainer.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-white-60);">Carregando conversas...</div>';

        if (room.kind === 'direct') {
            localStorage.setItem('nebula_bell_seen_' + emailClean, Date.now().toString());
            if (typeof NebulaApp !== 'undefined') NebulaApp.updateBell();
        }

        loadMessages();
        _pollTimer = setInterval(loadMessages, 2000);
    }

    function selectPeer(peerEmail) {
        const clean = (peerEmail || '').toLowerCase().trim();
        let idx = rooms.findIndex(r => (r.peer || '').toLowerCase().trim() === clean);
        if (idx <= 0) {
            rooms = getAvailableRooms(state, email);
            idx = rooms.findIndex(r => (r.peer || '').toLowerCase().trim() === clean);
            renderRoomsList();
        }
        if (idx > -1) selectRoom(idx);
        document.getElementById('chat-draft')?.focus();
    }

    async function loadMessages() {
        const room = rooms[activeRoomIdx];
        if (!room) return;

        const msgs = await getRoomMessages(room.id, email, room.peer);
        const msgContainer = document.getElementById('chat-messages-container');
        if (!msgContainer) return;

        const lastMsg = msgs[msgs.length - 1];
        const currentHash = msgs.length + '::' + (lastMsg?.id || '') + '::' + (lastMsg?.timestamp || '') + '::' + (lastMsg?.text || '').slice(-20);

        renderTypingIndicator(room);

        if (currentHash !== lastRenderedHash) {
            lastRenderedHash = currentHash;
            const atBottom = msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 160;
            renderMsgs(room, msgs);
            if (atBottom || msgs.length > 0) {
                msgContainer.scrollTop = msgContainer.scrollHeight;
            }
        }
    }

    function renderMsgs(room, msgs) {
        const msgContainer = document.getElementById('chat-messages-container');
        if (!msgContainer) return;

        if (!msgs.length) {
            msgContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-white-60); font-size:0.9rem;">
                ${room.kind === 'ai' ? 'Olá! Sou o Llama 3.3. Como posso ajudar na sua pesquisa hoje?' : 'Nenhuma mensagem ainda. Digite sua mensagem abaixo!'}
            </div>`;
            return;
        }

        let html = `<div style="display:flex; flex-direction:column; gap:0.8rem;">`;
        msgs.forEach(msg => {
            const senderClean = (msg.sender_email || '').toLowerCase().trim();
            const isMe = senderClean === emailClean;
            const isAi = msg.sender_email === 'ai@nebula' || msg.sender_email === 'ai';
            const time = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

            const userKey = NebulaStorage.findUserKey(state, msg.sender_email);
            const senderUser = userKey ? state.users[userKey] : {};
            const senderPhoto = senderUser.photo || null;
            const senderInitial = isAi ? 'IA' : (senderUser.name || msg.sender_name || 'U').trim().charAt(0).toUpperCase();

            html += `
                <div style="display:flex; gap:0.6rem; align-items:flex-start; justify-content:${isMe ? 'flex-end' : 'flex-start'};">
                    ${!isMe ? `
                    <div style="width:32px;height:32px;border-radius:50%;background:${isAi ? '#3b82f6' : 'var(--color-blue)'};display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;">
                        ${senderPhoto ? `<img src="${senderPhoto}" style="width:100%;height:100%;object-fit:cover;">` : senderInitial}
                    </div>` : ''}
                    <div class="chat-bubble ${isMe ? 'me' : ''}" style="margin:0;max-width:75%;">
                        <div style="display:flex;justify-content:space-between;gap:1rem;font-size:0.75rem;color:var(--text-white-60);margin-bottom:0.25rem;">
                            <span><b>${isAi ? 'Llama 3.3 (IA)' : (msg.sender_name || senderUser.name || 'Usuário')}</b></span>
                            <span>${time}</span>
                        </div>
                        <div style="word-break:break-word;font-size:0.92rem;color:var(--text-white-80);line-height:1.4;">${(msg.text || '').replace(/\n/g, '<br>')}</div>
                    </div>
                    ${isMe ? `
                    <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;">
                        ${senderPhoto ? `<img src="${senderPhoto}" style="width:100%;height:100%;object-fit:cover;">` : senderInitial}
                    </div>` : ''}
                </div>`;
        });
        html += '</div>';
        msgContainer.innerHTML = html;
    }

    async function openChatWithTarget(targetEmail) {
        const clean = (targetEmail || '').toLowerCase().trim();
        if (!clean || clean === 'ai') return;

        await NebulaStorage.ensureUserProfile(state, clean);
        rooms = getAvailableRooms(state, email);

        let idx = rooms.findIndex(r => (r.peer || '').toLowerCase().trim() === clean);
        if (idx <= 0) {
            const userKey = NebulaStorage.findUserKey(state, clean);
            const userObj = userKey ? state.users[userKey] : null;
            const roomId = buildRoomId(emailClean, userKey || clean);
            rooms.push({
                id: roomId,
                label: userObj?.name || clean.split('@')[0],
                peer: userKey || clean,
                kind: 'direct',
                shared_topics: ['Pesquisa Científica'],
                similarity: 0
            });
            idx = rooms.length - 1;
        }
        activeRoomIdx = idx;
    }

    async function render(container, stateObj) {
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        if (_typingTimer) { clearInterval(_typingTimer); _typingTimer = null; }

        state = stateObj;
        email = state.current_user;
        emailClean = (email || '').toLowerCase().trim();

        await NebulaStorage.syncInboxFromSupabase(state, email);
        await NebulaStorage.syncWorkspaceStateAsync(state, email);

        rooms = getAvailableRooms(state, email);
        activeRoomIdx = 0;

        if (state.chat_target) {
            await openChatWithTarget(state.chat_target);
            state.chat_target = null;
        }

        container.innerHTML = `
            <div class="page-title">Mensagens</div>
            <div class="chat-layout-container">
                <div class="chat-sidebar-panel glass">
                    <div class="section-title" style="margin-bottom:0.5rem;">Conversas</div>
                    <div id="chat-rooms-list"></div>
                </div>
                <div class="chat-main-panel glass" style="border-radius:24px;padding:0;">
                    <div class="chat-header-bar" id="chat-active-header"></div>
                    <div class="chat-messages-scroll" id="chat-messages-container"></div>
                    <div style="padding:1.2rem;border-top:1px solid rgba(0,0,0,0.05);border-bottom-left-radius:24px;border-bottom-right-radius:24px;">
                        <div id="chat-status" style="font-size:0.8rem;color:var(--text-white-60);min-height:1rem;margin-bottom:0.4rem;"></div>
                        <textarea id="chat-draft" class="textarea" placeholder="Digite sua mensagem..." style="background:rgba(255,255,255,0.4);border:1px solid rgba(0,0,0,0.08);border-radius:12px;min-height:50px;font-size:0.92rem;padding:0.75rem 1rem;color:var(--text-white-80);"></textarea>
                        <div style="display:flex;justify-content:flex-end;margin-top:0.65rem;">
                            <button class="btn btn-primary" id="chat-send-btn" style="min-width:140px;padding:0.6rem 1.2rem;font-size:0.88rem;">Enviar mensagem</button>
                        </div>
                    </div>
                </div>
            </div>`;

        renderRoomsList();
        renderHeader(rooms[activeRoomIdx]);

        if (state.chat_draft) {
            const draft = document.getElementById('chat-draft');
            if (draft) { draft.value = state.chat_draft; state.chat_draft = null; }
        }

        loadMessages();
        _pollTimer = setInterval(loadMessages, 2000);

        const btn = document.getElementById('chat-send-btn');
        const chatDraft = document.getElementById('chat-draft');

        chatDraft.addEventListener('input', () => {
            const room = rooms[activeRoomIdx];
            if (room && room.kind === 'direct') {
                NebulaStorage.setTypingIndicator(room.id, emailClean);
            }
        });

        btn.addEventListener('click', async () => {
            const text = chatDraft.value.trim();
            if (!text) return;
            const room = rooms[activeRoomIdx];
            const sender = state.users[email] || state.users[emailClean] || {};

            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const msgObj = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                room_id: room.id,
                room_label: room.label || '',
                recipient_email: room.peer,
                sender_email: emailClean,
                sender_name: sender.name || email,
                text: text.slice(0, 2000),
                timestamp: Date.now(),
                created_at: new Date().toISOString(),
            };

            await sendMessage(msgObj);
            chatDraft.value = '';
            btn.disabled = false;
            btn.textContent = 'Enviar mensagem';
            lastRenderedHash = '';
            await loadMessages();

            if (room.kind === 'ai') {
                btn.disabled = true;
                btn.textContent = 'Llama 3.3 digitando...';
                const statusEl = document.getElementById('chat-status');
                if (statusEl) statusEl.innerHTML = `<span class="chat-typing-indicator"><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span> Llama 3.3 está digitando...</span>`;
                try {
                    const allMsgs = await getRoomMessages(room.id, email, 'ai');
                    const sysPrompt = 'Você é o Llama 3.3, assistente de inteligência artificial do Nebula Research. Responda de forma direta, clara e inteligente em português.';
                    const messages = [{ role: 'system', content: sysPrompt }];
                    allMsgs.slice(-10).forEach(m => {
                        messages.push({
                            role: (m.sender_email === 'ai@nebula' || m.sender_email === 'ai') ? 'assistant' : 'user',
                            content: m.text
                        });
                    });

                    let aiResponse = await NebulaAI.chatWithAI(messages);
                    if (!aiResponse || aiResponse.startsWith('Ocorreu um erro') || aiResponse.startsWith('Erro de conexão')) {
                        aiResponse = 'Desculpe, tive um problema momentâneo. Pode repetir sua pergunta?';
                    }

                    const aiMsg = {
                        id: Date.now().toString(36) + 'ai',
                        room_id: room.id,
                        room_label: room.label || 'Llama 3.3',
                        recipient_email: emailClean,
                        sender_email: 'ai@nebula',
                        sender_name: 'Llama 3.3',
                        text: aiResponse,
                        timestamp: Date.now(),
                        created_at: new Date().toISOString(),
                    };
                    await sendMessage(aiMsg);
                } catch (e) {
                    console.error('[Chat] AI Llama error:', e);
                }
                const aiStatusEl = document.getElementById('chat-status');
                if (aiStatusEl) aiStatusEl.textContent = '';
                btn.disabled = false;
                btn.textContent = 'Enviar mensagem';
                lastRenderedHash = '';
                await loadMessages();
            }
        });

        chatDraft.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); btn.click(); }
        });
    }

    return { render, selectRoom, selectPeer, buildRoomId, getStoredMessages, saveStoredMessages, openChatWithTarget };
})();
