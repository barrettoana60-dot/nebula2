/* PAGE: CHAT */
const PageChat = (() => {
    function buildRoomId(a, b) {
        const sorted = [a, b].sort().join('||');
        let h = 0; for (let i = 0; i < sorted.length; i++) { h = ((h << 5) - h + sorted.charCodeAt(i)) | 0; }
        return `direct::${(h >>> 0).toString(16)}`;
    }

    function getAvailableRooms(state, email) {
        const rooms = [{ id: `private::${email}`, label: 'Chat privado', peer: null, kind: 'private' }];
        const connections = getConnectedUsers(state, email, 12);
        connections.forEach(conn => {
            rooms.push({ id: buildRoomId(email, conn.email), label: `Chat · ${conn.name}`, peer: conn.email, kind: 'direct', shared_topics: conn.shared_topics || [] });
        });
        return rooms;
    }

    function render(container, state) {
        const email = state.current_user;
        const connections = getConnectedUsers(state, email, 12);
        const rooms = getAvailableRooms(state, email);

        let html = `
            <div class="page-title">Chat</div>
            <div class="page-sub">Converse apenas com usuários conectados por afinidade real entre repositórios</div>
            <div class="grid-2">
                <div>
                    <div class="glass"><div class="section-title">Conexões por repositório</div>
                        ${!connections.length ? `<div class="small-muted">Quando seu repositório tiver temas em comum com outros usuários, os chats aparecerão aqui.</div>` : ''}
                        ${connections.map(conn => {
                            const topics = (conn.shared_topics||[]).slice(0,3).join(', ') || 'Tema cruzado';
                            return `<div class="doc-card"><b>${conn.name}</b><br><span class="small-muted">${conn.topic} · ${conn.similarity}%</span><div style="margin-top:0.45rem"><span class="tag">${topics}</span></div></div>`;
                        }).join('')}
                    </div>
                </div>
                <div>
                    <div class="glass"><div class="section-title">Conversas protegidas</div>
                        <div class="input-group"><label class="input-label">Sala</label>
                            <select class="select" id="chat-room-select">
                                ${rooms.map((r,i)=>`<option value="${i}">${r.label}</option>`).join('')}
                            </select>
                        </div>
                        <div id="chat-messages-container"></div>
                        <div class="input-group mt-1">
                            <textarea id="chat-draft" class="textarea" placeholder="Compartilhe uma referência, uma pergunta ou um resumo curto..."></textarea>
                        </div>
                        <button class="btn btn-primary btn-full" id="chat-send-btn">Publicar mensagem</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        const roomSelect = document.getElementById('chat-room-select');
        const msgContainer = document.getElementById('chat-messages-container');

        function renderMessages() {
            const roomIdx = parseInt(roomSelect.value);
            const room = rooms[roomIdx];
            const roomId = room.id;
            let msgs = (state.community_messages || []).filter(m => m.room_id === roomId);
            if (roomId.startsWith('private::')) msgs = msgs.filter(m => m.sender_email === email);
            msgs = msgs.slice(-80);

            if (room.kind === 'private') {
                msgContainer.innerHTML = `<div class="notice-box mb-1">Espaço privado para anotações rápidas.</div>`;
            } else {
                msgContainer.innerHTML = '';
            }

            if (!msgs.length) {
                msgContainer.innerHTML += `<div class="notice-box">Ainda não há mensagens nesta conversa.</div>`;
            } else {
                let chatHtml = `<div class="chat-shell">`;
                msgs.forEach(msg => {
                    const isMe = msg.sender_email === email;
                    chatHtml += `<div class="chat-bubble ${isMe ? 'me' : ''}">
                        <div class="chat-meta"><span><b>${msg.sender_name || 'Usuário'}</b> · ${msg.sender_topic || ''}</span><span>${msg.created_at || ''}</span></div>
                        <div class="chat-text">${msg.text || ''}</div>
                    </div>`;
                });
                chatHtml += `</div>`;
                msgContainer.innerHTML += chatHtml;
            }
        }

        roomSelect.addEventListener('change', renderMessages);
        renderMessages();

        document.getElementById('chat-send-btn').addEventListener('click', () => {
            const text = document.getElementById('chat-draft').value.trim();
            if (!text) { alert('Escreva uma mensagem antes de publicar.'); return; }
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
            });
            NebulaStorage.saveState(state);
            document.getElementById('chat-draft').value = '';
            renderMessages();
        });
    }
    return { render };
})();
