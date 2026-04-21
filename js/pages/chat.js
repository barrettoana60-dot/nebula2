/* PAGE: CHAT */
const PageChat = (() => {
    function buildRoomId(a, b) {
        const sorted = [a, b].sort().join('||');
        let h = 0; for (let i = 0; i < sorted.length; i++) { h = ((h << 5) - h + sorted.charCodeAt(i)) | 0; }
        return `direct::${(h >>> 0).toString(16)}`;
    }

    function getAvailableRooms(state, email) {
        const rooms = [{ id: `private::${email}`, label: 'Bloco de notas pessoal', peer: null, kind: 'private' }];
        const connections = getConnectedUsers(state, email, 12);
        connections.forEach(conn => {
            const roomId = buildRoomId(email, conn.email);
            const unread = countUnread(state, roomId, email);
            rooms.push({ id: roomId, label: `${conn.name}`, peer: conn.email, kind: 'direct', shared_topics: conn.shared_topics || [], unread });
        });
        return rooms;
    }

    function countUnread(state, roomId, email) {
        const msgs = (state.community_messages || []).filter(m => m.room_id === roomId && m.sender_email !== email);
        const lastRead = (state.chat_last_read || {})[roomId] || 0;
        return msgs.filter(m => (m.timestamp || 0) > lastRead).length;
    }

    function markAsRead(state, roomId) {
        if (!state.chat_last_read) state.chat_last_read = {};
        state.chat_last_read[roomId] = Date.now();
        NebulaStorage.saveState(state);
    }

    function render(container, state) {
        const email = state.current_user;
        const connections = getConnectedUsers(state, email, 12);
        const rooms = getAvailableRooms(state, email);

        let html = `
            <div class="page-title">Comunidade</div>
            <div class="page-sub">Converse com outros pesquisadores conectados pela similaridade do seu acervo</div>
            <div class="grid-60-40">
                <div>
                    <div class="glass">
                        <div class="section-title">Conversa</div>
                        <div class="input-group"><label class="input-label">Selecione o chat</label>
                            <select class="select" id="chat-room-select" style="background: rgba(0,0,0,0.4);">
                                ${rooms.map((r,i) => {
                                    const badge = r.unread ? ` (${r.unread} nova${r.unread>1?'s':''})` : '';
                                    const icon = r.kind === 'private' ? 'Doc: ' : 'Msg: ';
                                    return `<option value="${i}" data-peer="${r.peer}">${icon}${r.label}${badge}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div id="chat-messages-container" style="background:rgba(0,0,0,0.2); border-radius:16px; padding:1rem; border:1px solid rgba(255,255,255,0.05); min-height:300px; max-height:500px; overflow-y:auto; margin-bottom:1rem;"></div>
                        <div class="input-group">
                            <textarea id="chat-draft" class="textarea" placeholder="Compartilhe uma referência, uma pergunta ou inicie um debate..." style="background:rgba(0,0,0,0.3);min-height:80px"></textarea>
                        </div>
                        <button class="btn btn-primary btn-full" id="chat-send-btn">ENVIAR MENSAGEM</button>
                    </div>
                </div>
                <div>
                    <div class="glass" style="max-height:600px; overflow-y:auto;">
                        <div class="section-title">Pesquisadores Conectados</div>
                        <p class="small-muted mb-1">Clique para abrir conversa direta</p>
                        ${!connections.length ? `<div class="info-box">Adicione mais artigos ao repositório para o sistema cruzar seus dados e encontrar pesquisadores semelhantes.</div>` : ''}
                        ${connections.map(conn => {
                            const topics = (conn.shared_topics||[]).slice(0,3).join(', ') || 'Tema cruzado';
                            const roomId = buildRoomId(email, conn.email);
                            const unread = countUnread(state, roomId, email);
                            const badge = unread ? `<span style="background:var(--copper-1);color:#000;padding:0.15rem 0.5rem;border-radius:99px;font-size:0.7rem;font-weight:600;margin-left:0.5rem">${unread}</span>` : '';
                            return `
                                <div class="doc-card" style="padding:1rem;cursor:pointer" onclick="PageChat.selectPeer('${conn.email}')">
                                    <b>${conn.name}</b>${badge}<br>
                                    <span class="small-muted" style="color:var(--copper-1)">Compatibilidade: ${conn.similarity}%</span>
                                    <div style="margin-top:0.45rem"><span class="tag tag-copper">${topics}</span></div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        const roomSelect = document.getElementById('chat-room-select');
        const msgContainer = document.getElementById('chat-messages-container');
        const chatDraft = document.getElementById('chat-draft');

        function renderMessages() {
            const roomIdx = parseInt(roomSelect.value);
            const room = rooms[roomIdx];
            const roomId = room.id;
            let msgs = (state.community_messages || []).filter(m => m.room_id === roomId);
            if (roomId.startsWith('private::')) msgs = msgs.filter(m => m.sender_email === email);
            msgs = msgs.slice(-50);

            // Mark as read
            if (room.kind === 'direct') markAsRead(state, roomId);

            if (room.kind === 'private') {
                msgContainer.innerHTML = `<div class="notice-box mb-1" style="border-color:var(--copper-1); color:var(--copper-1)">Espaço privado para anotações rápidas sobre sua pesquisa. Ninguém mais vê isso.</div>`;
            } else {
                msgContainer.innerHTML = `<div class="notice-box mb-1" style="border-color:rgba(255,255,255,0.1); color:var(--text-white-60)">Conversa com <b>${room.label}</b> — mensagens sobre pesquisas em comum.</div>`;
            }

            if (!msgs.length) {
                msgContainer.innerHTML += `<div class="info-box" style="margin-top:2rem;">Nenhuma mensagem enviada ainda. Quebre o gelo!</div>`;
            } else {
                let chatHtml = `<div class="chat-shell">`;
                msgs.forEach(msg => {
                    const isMe = msg.sender_email === email;
                    chatHtml += `<div class="chat-bubble ${isMe ? 'me' : ''}">
                        <div class="chat-meta"><span><b>${msg.sender_name || 'Usuário'}</b></span><span>${msg.created_at || ''}</span></div>
                        <div class="chat-text">${msg.text || ''}</div>
                    </div>`;
                });
                chatHtml += `</div>`;
                msgContainer.innerHTML += chatHtml;
                setTimeout(() => { msgContainer.scrollTop = msgContainer.scrollHeight; }, 10);
            }
        }

        roomSelect.addEventListener('change', renderMessages);
        
        // Check for directed chat from connections page
        if (state.chat_target) {
            for(let i=0; i<roomSelect.options.length; i++) {
                if (roomSelect.options[i].getAttribute('data-peer') === state.chat_target) {
                    roomSelect.selectedIndex = i;
                    break;
                }
            }
            if (state.chat_draft) {
                chatDraft.value = state.chat_draft;
                state.chat_draft = null;
            }
            state.chat_target = null;
        }
        
        renderMessages();

        document.getElementById('chat-send-btn').addEventListener('click', () => {
            const text = chatDraft.value.trim();
            if (!text) return;
            const roomIdx = parseInt(roomSelect.value);
            const room = rooms[roomIdx];
            const sender = state.users[email] || {};
            
            if (!state.community_messages) state.community_messages = [];
            state.community_messages.push({
                id: Date.now().toString(36),
                room_id: room.id,
                room_label: room.label,
                sender_email: email,
                sender_name: sender.name || email,
                sender_topic: TextEngine.detectTopic(sender.research || ''),
                text: text.slice(0, 2000),
                created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
                timestamp: Date.now(),
            });
            NebulaStorage.saveState(state);
            chatDraft.value = '';
            renderMessages();
        });

        // Enter to send (Shift+Enter for new line)
        chatDraft.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('chat-send-btn').click();
            }
        });
    }

    function selectPeer(peerEmail) {
        const roomSelect = document.getElementById('chat-room-select');
        if (!roomSelect) return;
        for(let i=0; i<roomSelect.options.length; i++) {
            if (roomSelect.options[i].getAttribute('data-peer') === peerEmail) {
                roomSelect.selectedIndex = i;
                roomSelect.dispatchEvent(new Event('change'));
                document.getElementById('chat-draft')?.focus();
                break;
            }
        }
    }

    return { render, selectPeer };
})();
