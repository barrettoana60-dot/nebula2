/* PAGE: CHAT — Cloud & Local Persistent Messaging with Supabase sync */
const PageChat = (() => {
    let _pollTimer = null;
    let _sendLock = false;
    let _optimisticMsgs = [];
    let _typingTimer = null;
    let _presenceTimer = null;
    let _presenceList = [];
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

    function chatStoreKey(userEmail) {
        return 'nebula_chat_store_v3_' + (userEmail || '').toLowerCase().trim();
    }

    function getStoredMessages() {
        try {
            return JSON.parse(localStorage.getItem(chatStoreKey(emailClean || email)) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveStoredMessages(msgs) {
        try {
            localStorage.setItem(chatStoreKey(emailClean || email), JSON.stringify(msgs.slice(-500)));
        } catch (e) {
            console.warn('[ChatStore] Erro ao salvar cache:', e);
        }
    }

    function messageBelongsToRoom(m, targetRoomId, cleanMine, cleanPeer, isAi) {
        if (!m || !m.text) return false;
        const s = (m.sender_email || '').toLowerCase().trim();
        const r = (m.recipient_email || '').toLowerCase().trim();
        if (isAi) {
            return m.room_id?.startsWith('ai::') || s === 'ai@nebula' || s === 'ai';
        }
        if (m.room_id && m.room_id === targetRoomId) return true;
        return (s === cleanPeer && r === cleanMine) || (s === cleanMine && r === cleanPeer);
    }

    function collectPeersFromMessages(stateObj, myEmailClean) {
        const peers = new Map();
        getStoredMessages().forEach(m => {
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

    async function collectPeersAsync(stateObj, myEmailClean) {
        const peers = collectPeersFromMessages(stateObj, myEmailClean);
        try {
            const remote = await NebulaStorage.fetchChatPeersFromSupabase(myEmailClean);
            remote.forEach((name, email) => peers.set(email, name));
        } catch (e) {}
        return peers;
    }

    async function getAvailableRooms(stateObj, userEmail) {
        const list = [
            { id: 'ai::llama33', label: 'Llama 3.3 (Assistente IA)', peer: 'ai', kind: 'ai' }
        ];

        const myEmailClean = (userEmail || '').toLowerCase().trim();
        const knownPeers = new Map();

        (await collectPeersAsync(stateObj, myEmailClean)).forEach((name, peerEmail) => {
            const userKey = (NebulaStorage.findUserKey(stateObj, peerEmail) || peerEmail).toLowerCase().trim();
            const userObj = stateObj.users[userKey] || {};
            knownPeers.set(userKey, {
                name: userObj.name || name || userKey,
                email: userKey,
                shared_topics: [],
                similarity: 0,
                hasMessages: true
            });
        });

        const conns = NetworkEngine.getAffinityConnections(stateObj, userEmail, 20);
        conns.forEach(c => {
            const cleanC = (c.email || '').toLowerCase().trim();
            if (cleanC !== myEmailClean) {
                const existing = knownPeers.get(cleanC);
                knownPeers.set(cleanC, {
                    name: c.name || c.email,
                    email: cleanC,
                    shared_topics: c.shared_topics || [],
                    similarity: c.similarity || 0,
                    hasMessages: existing?.hasMessages || false
                });
            }
        });

        const sortedPeers = Array.from(knownPeers.values()).sort((a, b) => {
            if (a.hasMessages && !b.hasMessages) return -1;
            if (!a.hasMessages && b.hasMessages) return 1;
            return (b.similarity || 0) - (a.similarity || 0);
        });

        sortedPeers.forEach(peerData => {
            list.push({
                id: buildRoomId(myEmailClean, peerData.email),
                label: peerData.name,
                peer: peerData.email,
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
        saveStoredMessages(NebulaStorage.mergeMessagesUnique(localStore, [msgObj]));

        if (isAi) return;

        msgObj._pending = true;
        _optimisticMsgs = NebulaStorage.mergeMessagesUnique(_optimisticMsgs, [msgObj]);

        try {
            const ok = await NebulaStorage.saveMessageToSupabase(msgObj);
            if (ok) msgObj.delivered = true;
        } catch (e) {
            console.warn('[Chat] Supabase send fallback to local:', e);
        } finally {
            _optimisticMsgs = _optimisticMsgs.filter(m => m.id !== msgObj.id);
        }
    }

    async function getRoomMessages(roomId, myEmail, peerEmail) {
        const isAi = roomId.startsWith('ai::') || peerEmail === 'ai';
        const cleanMine = (myEmail || '').toLowerCase().trim();
        const cleanPeer = (peerEmail || '').toLowerCase().trim();
        const targetRoomId = isAi ? roomId : buildRoomId(cleanMine, cleanPeer);

        if (isAi) {
            const aiMsgs = getStoredMessages().filter(m =>
                messageBelongsToRoom(m, targetRoomId, cleanMine, cleanPeer, true)
            );
            return NebulaStorage.mergeMessagesUnique([], aiMsgs)
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }

        // Local messages for this room
        const localRoomMsgs = getStoredMessages().filter(m =>
            messageBelongsToRoom(m, targetRoomId, cleanMine, cleanPeer, false)
        );

        let cloudMsgs = [];
        try {
            cloudMsgs = await NebulaStorage.fetchMessagesFromSupabase(targetRoomId, cleanMine, cleanPeer);
            if (cloudMsgs && cloudMsgs.length > 0) {
                // Cache any new cloud messages in local store
                saveStoredMessages(NebulaStorage.mergeMessagesUnique(getStoredMessages(), cloudMsgs));
            }
        } catch (e) {}

        const pending = _optimisticMsgs.filter(m =>
            messageBelongsToRoom(m, targetRoomId, cleanMine, cleanPeer, false)
        );

        const merged = NebulaStorage.mergeMessagesUnique(localRoomMsgs, cloudMsgs);
        return NebulaStorage.mergeMessagesUnique(merged, pending)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }

    function openPhotoViewer(url, title) {
        if (!url) return;
        const existing = document.getElementById('nebula-photo-lightbox');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'nebula-photo-lightbox';
        overlay.className = 'photo-lightbox';
        overlay.innerHTML = `
            <div class="photo-lightbox-backdrop" onclick="document.getElementById('nebula-photo-lightbox')?.remove()"></div>
            <div class="photo-lightbox-content">
                <button type="button" class="photo-lightbox-close" onclick="document.getElementById('nebula-photo-lightbox')?.remove()">✕</button>
                ${title ? `<div class="photo-lightbox-title">${title}</div>` : ''}
                <img src="${url}" alt="${title || 'Foto'}" class="photo-lightbox-img" style="max-height:80vh; max-width:90vw; object-fit:contain; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.6);">
            </div>`;
        document.body.appendChild(overlay);
    }
    window.openPhotoViewer = openPhotoViewer;

    function getPeerPhoto(peerEmail) {
        return NebulaStorage.getUserPhoto(state, peerEmail);
    }

    function renderStatusDots(status) {
        if (status === 'read') {
            return `<span class="msg-status msg-status-read" title="Visualizado" style="color:#3b82f6; font-weight:bold; letter-spacing:-2px; display:inline-flex; align-items:center;">✓✓</span>`;
        }
        if (status === 'delivered') {
            return `<span class="msg-status msg-status-delivered" title="Entregue" style="color:var(--text-white-60); font-weight:bold; letter-spacing:-2px; display:inline-flex; align-items:center;">✓✓</span>`;
        }
        return `<span class="msg-status msg-status-sent" title="Enviado" style="color:var(--text-white-60); font-weight:bold; display:inline-flex; align-items:center;">✓</span>`;
    }

    function getStatusLabel(room) {
        if (room.kind === 'ai') return 'Assistente IA';
        const sim = room.similarity || 0;
        const viewed = NebulaStorage.hasViewedProfile(state, emailClean, room.peer);
        const parts = [];
        if (viewed) parts.push('Visualizado');
        if (sim >= 15) parts.push(`${sim}% afinidade`);
        else if (room.shared_topics?.length) parts.push(room.shared_topics[0]);
        return parts.length ? parts.join(' · ') : 'Pesquisador';
    }

    async function renderResearcherSearchResults(query) {
        const box = document.getElementById('chat-researcher-search-results');
        if (!box) return;
        const q = (query || '').trim();
        if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }

        box.innerHTML = `<div style="padding:0.6rem;font-size:0.8rem;color:var(--text-white-60);">Buscando...</div>`;
        box.style.display = 'block';

        const results = await NebulaStorage.searchResearchersAsync(state, q, emailClean, 8);
        if (!results.length) {
            box.innerHTML = `<div style="padding:0.6rem;font-size:0.8rem;color:var(--text-white-60);">Nenhum pesquisador encontrado.</div>`;
            box.style.display = 'block';
            return;
        }

        box.innerHTML = results.map(r => {
            const initial = (r.name || '?').charAt(0).toUpperCase();
            const photo = r.photo ? `<img src="${r.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : initial;
            const affLabel = r.similarity >= 15 ? `${r.similarity}% afinidade` : 'Sem afinidade calculada';
            return `<button type="button" class="chat-search-result" onclick="PageChat.startChatWith('${r.email}')" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.55rem 0.7rem;border:none;background:transparent;cursor:pointer;text-align:left;border-bottom:1px solid rgba(0,0,0,0.05);">
                <div style="width:28px;height:28px;border-radius:50%;background:var(--color-blue);overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.75rem;font-weight:700;flex-shrink:0;">${photo}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.82rem;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.name}</div>
                    <div style="font-size:0.72rem;color:var(--text-white-60);">${affLabel}</div>
                </div>
            </button>`;
        }).join('');
        box.style.display = 'block';
    }

    async function startChatWith(peerEmail) {
        const clean = (peerEmail || '').toLowerCase().trim();
        await NebulaStorage.ensureUserProfile(state, clean);
        await openChatWithTarget(clean);
        rooms = await getAvailableRooms(state, email);
        renderRoomsList();
        selectRoom(activeRoomIdx);
        const searchBox = document.getElementById('chat-researcher-search');
        const resultsBox = document.getElementById('chat-researcher-search-results');
        if (searchBox) searchBox.value = '';
        if (resultsBox) { resultsBox.innerHTML = ''; resultsBox.style.display = 'none'; }
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
                const online = r.kind === 'direct' && NebulaStorage.isUserOnline(_presenceList, r.peer);
                avatarHtml = `<div class="chat-list-item-avatar" style="position:relative;">${photo ? `<img src="${photo}" alt="">` : initial}${online ? '<span class="online-dot"></span>' : ''}</div>`;
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
            const online = NebulaStorage.isUserOnline(_presenceList, room.peer);
            avatarHtml = `<div class="chat-header-avatar user" style="cursor:pointer;position:relative;" onclick="PageProfile.render(document.getElementById('pageContainer'), NebulaApp.getState(), '${room.peer}')">${photo ? `<img src="${photo}" alt="" onclick="event.stopPropagation();PageChat.openPhotoViewer('${photo.replace(/'/g, "\\'")}','${(room.label || '').replace(/'/g, "\\'")}')">` : initial}${online ? '<span class="online-dot"></span>' : ''}</div>`;
            const sim = room.similarity || 0;
            const viewed = NebulaStorage.hasViewedProfile(state, emailClean, room.peer);
            const topics = room.shared_topics?.length ? room.shared_topics.slice(0, 3).join(', ') : 'Pesquisa Científica';
            subtitleHtml =
                (online ? `<span style="font-size:0.8rem;color:#10b981;font-weight:600;margin-right:8px;">● Online</span>` : `<span style="font-size:0.8rem;color:var(--text-white-40);margin-right:8px;">○ Offline</span>`) +
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
        const remoteTyping = NebulaStorage.getRemoteTypingPeers(_presenceList, room.id, emailClean);
        const localTyping = NebulaStorage.getTypingPeers(room.id, emailClean);
        const typingPeers = remoteTyping.length ? remoteTyping : localTyping;
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

    async function selectPeer(peerEmail) {
        const clean = (peerEmail || '').toLowerCase().trim();
        let idx = rooms.findIndex(r => (r.peer || '').toLowerCase().trim() === clean);
        if (idx <= 0) {
            rooms = await getAvailableRooms(state, email);
            idx = rooms.findIndex(r => (r.peer || '').toLowerCase().trim() === clean);
            renderRoomsList();
        }
        if (idx > -1) selectRoom(idx);
        document.getElementById('chat-draft')?.focus();
    }

    async function loadMessages() {
        const room = rooms[activeRoomIdx];
        if (!room) return;

        const newPresence = await NebulaStorage.fetchOnlinePresence();
        const presenceChanged = JSON.stringify(newPresence) !== JSON.stringify(_presenceList);
        _presenceList = newPresence;

        if (room.kind === 'direct') {
            NebulaStorage.markRoomMessagesRead(state, emailClean, room.peer, room.id);
            NebulaStorage.pulsePresence(emailClean, null, room.id);
        }

        const msgs = await getRoomMessages(room.id, email, room.peer);
        const msgContainer = document.getElementById('chat-messages-container');
        if (!msgContainer) return;

        const lastMsg = msgs[msgs.length - 1];
        const currentHash = msgs.length + '::' + (lastMsg?.id || '') + '::' + (lastMsg?.timestamp || '') + '::' + (lastMsg?.text || '').slice(-20) + '::' + _presenceList.length;

        renderTypingIndicator(room);
        renderHeader(room);

        if (currentHash !== lastRenderedHash || presenceChanged) {
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

        msgs = NebulaStorage.mergeMessagesUnique([], msgs);

        if (!msgs.length) {
            msgContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-white-60); font-size:0.9rem;">
                ${room.kind === 'ai'
                    ? '<div style="font-size:2rem;margin-bottom:0.75rem;">🤖</div><b>Llama 3.3</b><br><span style="font-size:0.82rem;">Inteligência Artificial para Pesquisa Acadêmica<br>Pergunte sobre sua área de pesquisa, referências, metodologia...</span>'
                    : 'Nenhuma mensagem ainda. Digite sua mensagem abaixo!'}
            </div>`;
            return;
        }

        const peerKey = room.peer ? NebulaStorage.findUserKey(state, room.peer) : null;
        const peerUser = peerKey ? state.users[peerKey] : {};
        const peerPhoto = peerUser?.photo || null;

        const myKey = NebulaStorage.findUserKey(state, emailClean);
        const myUser = myKey ? state.users[myKey] : {};
        const myPhoto = myUser?.photo || null;

        let html = `<div style="display:flex; flex-direction:column; gap:0.6rem; padding:0.5rem 0;">`;
        msgs.forEach(msg => {
            const senderClean = (msg.sender_email || '').toLowerCase().trim();
            const isMe = senderClean === emailClean;
            const isAi = msg.sender_email === 'ai@nebula' || msg.sender_email === 'ai';
            const time = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

            const msgStatus = isMe && !isAi ? NebulaStorage.getMessageStatus(msg, emailClean, room.peer, _presenceList, room.id) : null;
            let statusHtml = '';
            if (msgStatus === 'read') {
                statusHtml = `<span style="color:#3b82f6;font-weight:800;font-size:0.82rem;letter-spacing:-1.5px;" title="Visualizado">✓✓</span>`;
            } else if (msgStatus === 'delivered') {
                statusHtml = `<span style="color:rgba(255,255,255,0.5);font-weight:800;font-size:0.82rem;letter-spacing:-1.5px;" title="Entregue">✓✓</span>`;
            } else if (msgStatus === 'sent') {
                statusHtml = `<span style="color:rgba(255,255,255,0.4);font-weight:700;font-size:0.82rem;" title="Enviado">✓</span>`;
            }

            // Determine which photo to show for sender avatar
            let avatarContent = '';
            if (isAi) {
                avatarContent = `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:700;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(59,130,246,0.3);">IA</div>`;
            } else if (!isMe && peerPhoto) {
                avatarContent = `<div style="width:34px;height:34px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.15);cursor:pointer;" onclick="PageChat.openPhotoViewer('${peerPhoto.replace(/'/g,"\\'")}','${(peerUser?.name || room.label || '').replace(/'/g,"\\'")}')"><img src="${peerPhoto}" style="width:100%;height:100%;object-fit:cover;"></div>`;
            } else if (!isMe) {
                const initial = (msg.sender_name || room.label || '?').trim().charAt(0).toUpperCase();
                avatarContent = `<div style="width:34px;height:34px;border-radius:50%;background:var(--color-blue);display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;color:#fff;flex-shrink:0;">${initial}</div>`;
            } else if (isMe && myPhoto) {
                avatarContent = `<div style="width:34px;height:34px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.15);cursor:pointer;" onclick="PageChat.openPhotoViewer('${myPhoto.replace(/'/g,"\\'")}','Você')"><img src="${myPhoto}" style="width:100%;height:100%;object-fit:cover;"></div>`;
            } else if (isMe) {
                const myInitial = (myUser?.name || emailClean || 'U').trim().charAt(0).toUpperCase();
                avatarContent = `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;color:#fff;flex-shrink:0;">${myInitial}</div>`;
            }

            const bubbleBg = isMe
                ? 'rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.25);'
                : isAi ? 'rgba(59,130,246,0.07); border:1px solid rgba(59,130,246,0.15);'
                : 'rgba(218,200,179,0.9); border:1px solid rgba(0,0,0,0.06);';

            html += `
                <div style="display:flex; gap:0.5rem; align-items:flex-end; justify-content:${isMe ? 'flex-end' : 'flex-start'};">
                    ${!isMe ? avatarContent : ''}
                    <div style="max-width:72%; background:${bubbleBg} border-radius:${isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; padding:0.6rem 0.9rem; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                        <div style="display:flex;justify-content:space-between;gap:0.6rem;font-size:0.72rem;color:var(--text-white-60);margin-bottom:0.2rem;align-items:center;">
                            <span style="font-weight:700;">${isAi ? 'Llama 3.3' : (msg.sender_name || (isMe ? (myUser?.name || 'Você') : (peerUser?.name || room.label)) || 'Usuário')}</span>
                            <span style="display:flex;align-items:center;gap:0.25rem;white-space:nowrap;">${statusHtml}${time}</span>
                        </div>
                        <div style="word-break:break-word;font-size:0.9rem;color:var(--text-white-80);line-height:1.5;">${(msg.text || '').replace(/\n/g,'<br>')}</div>
                    </div>
                    ${isMe ? avatarContent : ''}
                </div>`;
        });
        html += '</div>';
        msgContainer.innerHTML = html;
    }

    async function openChatWithTarget(targetEmail) {
        const clean = (targetEmail || '').toLowerCase().trim();
        if (!clean || clean === 'ai') return;

        await NebulaStorage.ensureUserProfile(state, clean);
        const affinity = NetworkEngine.compareRepositories(state, emailClean, clean);
        rooms = await getAvailableRooms(state, email);

        let idx = rooms.findIndex(r => (r.peer || '').toLowerCase().trim() === clean);
        if (idx <= 0) {
            const userKey = NebulaStorage.findUserKey(state, clean) || clean;
            const userObj = state.users[userKey] || {};
            rooms.push({
                id: buildRoomId(emailClean, userKey),
                label: userObj.name || clean.split('@')[0],
                peer: userKey,
                kind: 'direct',
                shared_topics: affinity.shared_topics || [],
                similarity: affinity.similarity || 0
            });
            idx = rooms.length - 1;
        }
        activeRoomIdx = idx;
    }

    async function render(container, stateObj) {
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        if (_typingTimer) { clearInterval(_typingTimer); _typingTimer = null; }
        if (_presenceTimer) { clearInterval(_presenceTimer); _presenceTimer = null; }

        state = stateObj;
        email = state.current_user;
        emailClean = (email || '').toLowerCase().trim();
        _optimisticMsgs = [];

        await NebulaStorage.refreshCommunityDirectory(state);
        await NebulaStorage.syncWorkspaceStateAsync(state, email);

        rooms = await getAvailableRooms(state, email);
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
                    <input type="text" id="chat-researcher-search" class="input" placeholder="Buscar pesquisador por nome ou tema..." style="margin-bottom:0.5rem;font-size:0.85rem;padding:0.5rem 0.75rem;">
                    <div id="chat-researcher-search-results" style="display:none;max-height:180px;overflow-y:auto;background:rgba(255,255,255,0.35);border-radius:10px;margin-bottom:0.5rem;"></div>
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
        NebulaStorage.pulsePresence(emailClean, null);
        _presenceTimer = setInterval(() => NebulaStorage.pulsePresence(emailClean, null), 30000);

        const btn = document.getElementById('chat-send-btn');
        const chatDraft = document.getElementById('chat-draft');

        chatDraft.addEventListener('input', () => {
            const room = rooms[activeRoomIdx];
            if (room && room.kind === 'direct') {
                NebulaStorage.setTypingIndicator(room.id, emailClean);
            }
        });

        btn.addEventListener('click', async () => {
            if (_sendLock) return;
            const text = chatDraft.value.trim();
            if (!text) return;
            const room = rooms[activeRoomIdx];
            const sender = state.users[email] || state.users[emailClean] || {};

            // Clear input IMMEDIATELY so user feels speed
            chatDraft.value = '';
            const sendTime = Date.now();

            const msgObj = {
                id: sendTime.toString(36) + Math.random().toString(36).slice(2, 6),
                room_id: room.id,
                room_label: room.label || '',
                recipient_email: room.peer,
                sender_email: emailClean,
                sender_name: sender.name || email,
                text: text.slice(0, 2000),
                timestamp: sendTime,
                created_at: new Date(sendTime).toISOString(),
            };

            // Append to local store immediately (no await needed for display)
            const localStore = getStoredMessages();
            saveStoredMessages(NebulaStorage.mergeMessagesUnique(localStore, [msgObj]));
            _optimisticMsgs = NebulaStorage.mergeMessagesUnique(_optimisticMsgs, [msgObj]);

            // Re-render immediately
            lastRenderedHash = '';
            loadMessages();

            if (room.kind === 'ai') {
                _sendLock = true;
                btn.disabled = true;
                btn.textContent = '...';
                const statusEl = document.getElementById('chat-status');
                if (statusEl) statusEl.innerHTML = `<span class="chat-typing-indicator"><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>&nbsp;Llama 3.3 está digitando...</span>`;

                try {
                    const allMsgs = getStoredMessages().filter(m =>
                        messageBelongsToRoom(m, room.id, emailClean, 'ai', true)
                    ).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                    const sysPrompt = 'Você é o Llama 3.3, assistente de inteligência artificial do Nebula Research. Responda de forma direta, clara e inteligente em português. Seja útil e conciso.';
                    const messages = [{ role: 'system', content: sysPrompt }];
                    allMsgs.slice(-12).forEach(m => {
                        messages.push({
                            role: (m.sender_email === 'ai@nebula' || m.sender_email === 'ai') ? 'assistant' : 'user',
                            content: m.text
                        });
                    });

                    let aiResponse = await NebulaAI.chatWithAI(messages);
                    if (!aiResponse || aiResponse.trim().length < 2) {
                        aiResponse = 'Olá! Pode elaborar mais sua pergunta? Estou pronto para ajudar com sua pesquisa.';
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
                    const ls2 = getStoredMessages();
                    saveStoredMessages(NebulaStorage.mergeMessagesUnique(ls2, [aiMsg]));
                } catch (e) {
                    console.error('[Chat] AI Llama error:', e);
                } finally {
                    const aiStatusEl = document.getElementById('chat-status');
                    if (aiStatusEl) aiStatusEl.textContent = '';
                    _sendLock = false;
                    btn.disabled = false;
                    btn.textContent = 'Enviar mensagem';
                    lastRenderedHash = '';
                    loadMessages();
                }
            } else {
                // Non-AI: save to Supabase in background without blocking UI
                NebulaStorage.saveMessageToSupabase(msgObj).catch(e => {
                    console.warn('[Chat] Supabase send fallback to local:', e);
                }).finally(() => {
                    _optimisticMsgs = _optimisticMsgs.filter(m => m.id !== msgObj.id);
                });
            }
        });

        chatDraft.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); btn.click(); }
        });

        document.getElementById('chat-researcher-search')?.addEventListener('input', e => {
            renderResearcherSearchResults(e.target.value);
        });
    }

    return { render, selectRoom, selectPeer, buildRoomId, getStoredMessages, saveStoredMessages, openChatWithTarget, startChatWith, openPhotoViewer };
})();
