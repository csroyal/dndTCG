/* ============================================================
   SPECTATE — admins watch live simulator games and step in as the DM.

   Each player's board is mirrored into their profile as `battle` (see SPECTATING in
   simulator.js). This page listens to every profile while it's open and renders the boards.
   Interventions are queued as commands in the player's `battleCommands`; the player's own
   client applies them and records the outcome in `battleLog`.
============================================================ */

const spectateSection = document.getElementById('spectateSection');
const specList = document.getElementById('specBattleList');
const specView = document.getElementById('specView');
const SPEC_LIVE_MS = 3 * 60 * 1000;
const SPEC_IDLE_WARN_MS = 10 * 60 * 1000;

const spec = {
    unsub: null,
    players: [],          // [{ id, data }]
    focusedId: null,
    renderedId: null,     // which player's static panels are on screen
    message: '',
    add: { query: '', cardId: null, to: 'hand' },
};

const ADD_DESTINATIONS = [
    ['hand', 'Hand'], ['deckTop', 'Top of deck'], ['deckBottom', 'Bottom of deck'], ['deckShuffle', 'Shuffle into deck'],
    ['summon', 'Summon Zone'], ['reaction', 'Reaction Zone'], ['graveyard', 'Graveyard'], ['banish', 'Banish'],
];

/* ---------- Data ---------- */

function battleOf(player) {
    const b = player?.data.battle;
    if (!b?.started || !b.state) return null;
    try {
        const state = JSON.parse(b.state);
        return state.started ? { state, updatedAt: b.updatedAt || 0 } : null;
    } catch { return null; }
}

const specPlayer = () => spec.players.find(p => p.id === spec.focusedId);
const specCardName = (id) => getObjectById(cards, id)?.name || id;

function liveBattles() {
    return spec.players
        .map(p => ({ player: p, battle: battleOf(p) }))
        .filter(x => x.battle)
        .sort((a, b) => b.battle.updatedAt - a.battle.updatedAt);
}

function specStart() {
    if (spec.unsub || !isAdmin) return;
    specList.innerHTML = '<div class="empty-state">Looking for games…</div>';
    spec.unsub = db.collection('profiles').onSnapshot((snap) => {
        const players = [];
        snap.forEach(doc => players.push({ id: doc.id, data: doc.data() }));
        spec.players = players;
        renderSpecList();
        renderSpecView();
    }, (err) => {
        console.error('spectate listener failed', err);
        specList.innerHTML = '<div class="empty-state">Couldn\'t load games.</div>';
    });
}

function specStop() {
    spec.unsub?.();
    spec.unsub = null;
    spec.renderedId = null;
    closeSpecMenu();
}

new MutationObserver(() => {
    if (spectateSection.classList.contains('active') && isAdmin) specStart();
    else specStop();
}).observe(spectateSection, { attributes: true, attributeFilter: ['class'] });

// keep "last move 12s ago" fresh
setInterval(() => { if (spec.unsub) { renderSpecList(); updateSpecDynamic(); } }, 15000);

/* ---------- Sending commands ---------- */

async function sendBattleCommand(type, args, label) {
    const player = specPlayer();
    const battle = battleOf(player);
    if (!battle) { showToast('That game has ended.', 'info'); return; }
    const cmd = { id: generateUID(), at: Date.now(), by: currentProfile, game: battle.state.game || null, type, ...args };
    const msg = spec.message.trim();
    if (msg) cmd.message = msg.slice(0, 200);
    try {
        await db.collection('profiles').doc(player.id).update({ battleCommands: firebase.firestore.FieldValue.arrayUnion(cmd) });
        spec.message = '';
        const box = specView.querySelector('.spec-message');
        if (box) box.value = '';
        showToast(`Sent to ${player.data.name || player.id}: ${describeCommand(cmd) || label}.`, 'success');
    } catch (err) {
        console.error(err);
        showToast('Couldn\'t send that.', 'error');
    }
}

function describeCommand(cmd) {
    const n = specCardName(cmd.cardId);
    const dest = Object.fromEntries(ADD_DESTINATIONS);
    switch (cmd.type) {
        case 'add': return `Add ${n} → ${dest[cmd.to] || cmd.to}`;
        case 'summon': return ({ kill: `Kill ${n}`, hp: `Set ${n} to ${cmd.hp} HP`, heal: `Heal ${n}`, toHand: `Return ${n} to hand`, banish: `Banish ${n}` })[cmd.action];
        case 'reaction': return ({ destroy: `Destroy ${n}`, toHand: `Return ${n} to hand`, banish: `Banish ${n}` })[cmd.action];
        case 'hand': return ({ discard: `Discard ${n}`, banish: `Banish ${n} from hand`, deckTop: `Put ${n} on top of deck`, deckShuffle: `Shuffle ${n} into deck` })[cmd.action];
        case 'graveyard': return ({ toHand: `Return ${n} to hand`, banish: `Banish ${n}`, deckShuffle: `Shuffle ${n} into deck` })[cmd.action];
        case 'deck': return ({ shuffle: 'Shuffle deck', draw: `Draw ${cmd.n}`, mill: `Mill ${cmd.n}` })[cmd.action];
        case 'actions': return cmd.action === 'restore' ? 'Restore all actions' : `${cmd.action === 'spend' ? 'Spend' : 'Restore'} ${cmd.which}`;
        case 'tokens': return `${cmd.delta > 0 ? '+' : '−'}${Math.abs(cmd.delta)} ${cmd.token} token`;
        case 'turn': return 'End their turn';
    }
    return cmd.type;
}

/* ---------- Battle list ---------- */

function renderSpecList() {
    const battles = liveBattles();
    if (!battles.length) {
        specList.innerHTML = '<div class="empty-state">No one is in a battle right now. Games appear here as soon as a player starts one in the Simulator.</div>';
        if (spec.focusedId && !battleOf(specPlayer())) spec.focusedId = null;
        return;
    }
    if (!battles.some(x => x.player.id === spec.focusedId)) spec.focusedId = battles[0].player.id;
    specList.innerHTML = '';
    for (const { player, battle } of battles) {
        const s = battle.state;
        const live = Date.now() - battle.updatedAt < SPEC_LIVE_MS;
        const pending = (player.data.battleCommands || []).length;
        const row = document.createElement('div');
        row.className = 'admin-user spec-battle' + (player.id === spec.focusedId ? ' focused' : '');
        row.innerHTML = `
            ${avatarHTML(player.data)}
            <div class="admin-user-info">
                <div class="admin-user-name">${escapeHTML(player.data.name || player.id)}
                    <span class="spec-live ${live ? 'on' : ''}">${live ? 'Live' : 'Idle'}</span></div>
                <div class="admin-user-meta">Turn ${s.turn || 1} · ${(s.summons || []).length} summon${(s.summons || []).length === 1 ? '' : 's'} · ${(s.hand || []).length} in hand</div>
                <div class="admin-user-seen">Last move ${timeAgo(battle.updatedAt)}${pending ? ` · <strong>${pending} pending</strong>` : ''}</div>
            </div>`;
        row.addEventListener('click', () => { spec.focusedId = player.id; renderSpecList(); renderSpecView(); });
        makeActivatable(row, `Watch ${player.data.name || player.id}`);
        specList.append(row);
    }
}

/* ---------- Board view ---------- */

function renderSpecView() {
    const player = specPlayer();
    if (!battleOf(player)) {
        spec.renderedId = null;
        specView.innerHTML = '<div class="empty-state">Pick a game on the left to watch it.</div>';
        return;
    }
    // static panels (message box, card search) are built once per player so typing isn't interrupted
    if (spec.renderedId !== player.id) {
        spec.renderedId = player.id;
        specView.innerHTML = `
            <header class="spec-head"></header>
            <div class="spec-idle-note" hidden></div>
            <div class="spec-board"></div>
            <div class="spec-tools">
                <div class="admin-card spec-add">
                    <h3><i class="bi bi-plus-square"></i> Add a card</h3>
                    <input type="search" class="spec-add-search" placeholder="Search any card" value="${escapeHTML(spec.add.query)}">
                    <div class="admin-card-results spec-add-results"></div>
                    <div class="spec-add-row">
                        <select class="spec-add-to" aria-label="Where to put it">${ADD_DESTINATIONS.map(([k, l]) => `<option value="${k}" ${k === spec.add.to ? 'selected' : ''}>${l}</option>`).join('')}</select>
                        <button type="button" class="btn-accent spec-add-go" disabled><i class="bi bi-send"></i> Send</button>
                    </div>
                </div>
                <div class="admin-card">
                    <h3><i class="bi bi-chat-quote"></i> Message</h3>
                    <textarea class="spec-message" rows="2" maxlength="200" placeholder="Shown to the player with your next change (optional)">${escapeHTML(spec.message)}</textarea>
                    <h3 class="admin-subhead"><i class="bi bi-clock-history"></i> Interventions</h3>
                    <div class="spec-log"></div>
                </div>
            </div>`;
        bindSpecStatic();
    }
    updateSpecDynamic();
}

function bindSpecStatic() {
    const search = specView.querySelector('.spec-add-search');
    const results = specView.querySelector('.spec-add-results');
    const go = specView.querySelector('.spec-add-go');
    const drawResults = () => {
        const q = spec.add.query.trim().toLowerCase();
        results.innerHTML = '';
        go.disabled = !spec.add.cardId;
        if (!q) return;
        const hits = cards.filter(c => c.class !== 'Sleeve' && c.name.toLowerCase().includes(q)).slice(0, 6);
        if (!hits.length) results.innerHTML = '<p class="admin-muted">No cards match.</p>';
        for (const c of hits) {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'admin-card-result' + (c.id === spec.add.cardId ? ' picked' : '');
            opt.innerHTML = `<img src="./assets/card-art/${c.id}.jpg" alt="" loading="lazy"><span>${escapeHTML(c.name)}</span><span class="admin-rarity rarity-${c.rarity.toLowerCase()}">${c.class}</span>`;
            opt.addEventListener('click', () => { spec.add.cardId = c.id; drawResults(); });
            results.append(opt);
        }
    };
    search.addEventListener('input', () => { spec.add.query = search.value; drawResults(); });
    specView.querySelector('.spec-add-to').addEventListener('change', (e) => { spec.add.to = e.target.value; });
    go.addEventListener('click', () => {
        const card = getObjectById(cards, spec.add.cardId);
        if (!card) return;
        if (spec.add.to === 'summon' && card.class !== 'Summon') { showToast(`${card.name} isn't a Summon.`, 'error'); return; }
        if (spec.add.to === 'reaction' && card.class !== 'Reaction') { showToast(`${card.name} isn't a Reaction.`, 'error'); return; }
        const dest = Object.fromEntries(ADD_DESTINATIONS)[spec.add.to];
        sendBattleCommand('add', { cardId: card.id, to: spec.add.to }, `Sent ${card.name} → ${dest}`);
    });
    specView.querySelector('.spec-message').addEventListener('input', (e) => { spec.message = e.target.value; });
    drawResults();
}

function specCardTile(zone, id, index, extra = '') {
    const card = getObjectById(cards, id);
    if (!card) return '';
    return `<button type="button" class="spec-card rarity-${card.rarity.toLowerCase()}" data-zone="${zone}" data-index="${index}" data-card="${escapeHTML(id)}" title="${escapeHTML(card.name)}">
        <img src="./assets/card-art/${card.id}.jpg" alt="${escapeHTML(card.name)}" loading="lazy">${extra}</button>`;
}

function updateSpecDynamic() {
    const player = specPlayer();
    const battle = battleOf(player);
    if (!battle || spec.renderedId !== player.id) return;
    const s = battle.state;
    const name = player.data.name || player.id;
    const used = new Set(s.used || []);
    const live = Date.now() - battle.updatedAt < SPEC_LIVE_MS;
    const pips = [['action', 'Action'], ['bonusAction', 'Bonus'], ['reaction', 'Reaction']];

    specView.querySelector('.spec-head').innerHTML = `
        ${avatarHTML(player.data, 44)}
        <div class="spec-head-info">
            <h2>${escapeHTML(name)} <span class="spec-live ${live ? 'on' : ''}">${live ? 'Live' : 'Idle'}</span></h2>
            <span class="admin-user-seen">Last move ${timeAgo(battle.updatedAt)}</span>
        </div>
        <div class="spec-turn">
            <span class="spec-turn-num">Turn <strong>${s.turn || 1}</strong></span>
            <div class="spec-pips">${pips.map(([k, l]) => `<button type="button" class="spec-pip ${used.has(k) ? 'used' : ''}" data-pip="${k}" title="${used.has(k) ? `Restore their ${l}` : `Spend their ${l}`}"><span></span>${l}</button>`).join('')}</div>
            <button type="button" class="btn-ghost spec-small" data-cmd="restore"><i class="bi bi-arrow-counterclockwise"></i> Restore all</button>
            <button type="button" class="btn-ghost spec-small" data-cmd="turn"><i class="bi bi-skip-forward"></i> End turn</button>
        </div>`;

    const idle = specView.querySelector('.spec-idle-note');
    const stale = Date.now() - battle.updatedAt > SPEC_IDLE_WARN_MS;
    idle.hidden = !stale;
    if (stale) idle.innerHTML = `<i class="bi bi-moon-stars"></i> ${escapeHTML(name)} hasn't moved in ${timeAgo(battle.updatedAt).replace(' ago', '')}. Changes you send wait until they next open the app.`;

    const summons = s.summons || [];
    const hp = s.hp || [];
    const tokens = s.tokens || {};
    specView.querySelector('.spec-board').innerHTML = `
        <div class="spec-main">
            <div class="spec-zone"><h3>Summon Zone <span>${summons.length}/${MAX_ACTIVE_SUMMONS}</span></h3>
                <div class="spec-row">${summons.length ? summons.map((id, i) => specCardTile('summon', id, i,
                    `<span class="spec-hp ${(hp[i] ?? 0) <= 0 ? 'down' : ''}"><i class="bi bi-heart-fill"></i> ${hp[i] ?? summonDefaultHp(id)}</span>`)).join('') : '<p class="admin-muted">No summons on the field.</p>'}</div></div>
            <div class="spec-zone"><h3>Reaction Zone <span>${(s.reactions || []).length}</span></h3>
                <div class="spec-row">${(s.reactions || []).length ? s.reactions.map((id, i) => specCardTile('reaction', id, i)).join('') : '<p class="admin-muted">No Reactions set.</p>'}</div></div>
            <div class="spec-zone"><h3>Hand <span>${(s.hand || []).length}</span></h3>
                <div class="spec-row hand">${(s.hand || []).length ? s.hand.map((id, i) => specCardTile('hand', id, i)).join('') : '<p class="admin-muted">Their hand is empty.</p>'}</div></div>
        </div>
        <aside class="spec-side">
            <div class="spec-pile">
                <div class="spec-pile-head"><span><i class="bi bi-stack"></i> Deck</span><strong>${(s.deck || []).length}</strong></div>
                <div class="spec-pile-actions">
                    <button type="button" class="spec-small" data-cmd="draw">Draw 1</button>
                    <button type="button" class="spec-small" data-cmd="drawN">Draw X</button>
                    <button type="button" class="spec-small" data-cmd="mill">Mill 1</button>
                    <button type="button" class="spec-small" data-cmd="shuffle">Shuffle</button>
                </div>
                ${(s.deck || []).length ? `<div class="spec-next"><span class="admin-muted">Top card</span>${specCardTile('deckTop', s.deck[0], 0)}</div>` : ''}
            </div>
            <div class="spec-pile">
                <div class="spec-pile-head"><span><i class="bi bi-trash3"></i> Graveyard</span><strong>${(s.graveyard || []).length}</strong></div>
                <div class="spec-strip">${[...(s.graveyard || [])].map((id, i) => ({ id, i })).reverse().map(({ id, i }) => specCardTile('graveyard', id, i)).join('') || '<p class="admin-muted">Empty.</p>'}</div>
            </div>
            <div class="spec-pile">
                <div class="spec-pile-head"><span><i class="bi bi-hurricane"></i> Banished</span><strong>${(s.banish || []).length}</strong></div>
                <div class="spec-strip">${[...(s.banish || [])].map((id, i) => specCardTile('banish', id, i)).reverse().join('') || '<p class="admin-muted">Empty.</p>'}</div>
            </div>
            <div class="spec-pile">
                <div class="spec-pile-head"><span><i class="bi bi-coin"></i> Tokens</span></div>
                ${Object.keys(tokens).map(t => `<div class="spec-token"><span>${escapeHTML(t)}</span>
                    <div class="admin-qty small"><button type="button" data-token="${escapeHTML(t)}" data-d="-1" ${tokens[t] ? '' : 'disabled'}>−</button><span>${tokens[t]}</span><button type="button" data-token="${escapeHTML(t)}" data-d="1">+</button></div></div>`).join('')}
            </div>
        </aside>`;

    // pending commands + outcomes
    const pending = player.data.battleCommands || [];
    const log = [...(player.data.battleLog || [])].reverse().slice(0, 8);
    specView.querySelector('.spec-log').innerHTML = `
        ${pending.map(cmd => `<div class="spec-log-row pending"><i class="bi bi-hourglass-split"></i><span>${escapeHTML(describeCommand(cmd))}</span>
            <button type="button" class="btn-ghost spec-small spec-cancel" data-id="${cmd.id}">Cancel</button></div>`).join('')}
        ${log.map(e => `<div class="spec-log-row ${e.ok ? 'ok' : 'failed'}"><i class="bi ${e.ok ? 'bi-check2-circle' : 'bi-x-circle'}"></i>
            <span>${escapeHTML(e.text || '')}</span><span class="admin-muted">${escapeHTML(e.by || '')} · ${timeAgo(e.at)}</span></div>`).join('')}
        ${!pending.length && !log.length ? '<p class="admin-muted">Nothing yet. Click any card on the board to step in.</p>' : ''}`;

    bindSpecDynamic(player, s);
}

function bindSpecDynamic(player, s) {
    specView.querySelectorAll('.spec-card').forEach(tile => tile.addEventListener('click', (e) => {
        e.stopPropagation();
        openSpecMenu(tile, s);
    }));
    specView.querySelectorAll('.spec-pip').forEach(btn => btn.addEventListener('click', () => {
        const spend = !btn.classList.contains('used');
        sendBattleCommand('actions', { action: spend ? 'spend' : 'restoreOne', which: btn.dataset.pip }, `${spend ? 'Spent' : 'Restored'} their ${btn.textContent.trim()}`);
    }));
    const on = (sel, fn) => specView.querySelector(sel)?.addEventListener('click', fn);
    on('[data-cmd="restore"]', () => sendBattleCommand('actions', { action: 'restore' }, 'Restored their actions'));
    on('[data-cmd="turn"]', async () => {
        if (await showConfirm(`End <strong>${escapeHTML(player.data.name || player.id)}</strong>'s turn? They'll draw a card.`, { confirmLabel: 'End Turn', danger: false })) {
            sendBattleCommand('turn', {}, 'Ended their turn');
        }
    });
    on('[data-cmd="draw"]', () => sendBattleCommand('deck', { action: 'draw', n: 1 }, 'Made them draw'));
    on('[data-cmd="drawN"]', async () => {
        const n = parseInt(await showInput('Make them draw how many cards?', '2', '2'), 10);
        if (n > 0) sendBattleCommand('deck', { action: 'draw', n: Math.min(n, 20) }, `Made them draw ${n}`);
    });
    on('[data-cmd="mill"]', () => sendBattleCommand('deck', { action: 'mill', n: 1 }, 'Milled their top card'));
    on('[data-cmd="shuffle"]', () => sendBattleCommand('deck', { action: 'shuffle' }, 'Shuffled their deck'));
    specView.querySelectorAll('[data-token]').forEach(btn => btn.addEventListener('click', () => {
        const d = Number(btn.dataset.d);
        sendBattleCommand('tokens', { token: btn.dataset.token, delta: d }, `${d > 0 ? 'Gave' : 'Took'} a ${btn.dataset.token} token`);
    }));
    specView.querySelectorAll('.spec-cancel').forEach(btn => btn.addEventListener('click', async () => {
        const cmd = (player.data.battleCommands || []).find(c => c.id === btn.dataset.id);
        if (!cmd) return;
        try { await db.collection('profiles').doc(player.id).update({ battleCommands: firebase.firestore.FieldValue.arrayRemove(cmd) }); }
        catch (err) { console.error(err); showToast('Couldn\'t cancel that.', 'error'); }
    }));
}

/* ---------- Card action menu ---------- */

let specMenuEl = null;

function closeSpecMenu() {
    specMenuEl?.remove();
    specMenuEl = null;
}

document.addEventListener('click', (e) => { if (specMenuEl && !specMenuEl.contains(e.target)) closeSpecMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && specMenuEl) { e.stopPropagation(); closeSpecMenu(); } }, true);

function openSpecMenu(tile, state) {
    closeSpecMenu();
    const zone = tile.dataset.zone, index = Number(tile.dataset.index), cardId = tile.dataset.card;
    const n = specCardName(cardId);
    const target = { index, cardId };
    const hpNow = (state.hp || [])[index] ?? summonDefaultHp(cardId);
    const items = {
        summon: [
            ['bi-heartbreak-fill', 'Kill', () => sendBattleCommand('summon', { action: 'kill', ...target }, `Killed ${n}`), 'danger'],
            ['bi-heart-pulse', 'Set HP…', async () => {
                const v = await showInput(`Set ${escapeHTML(n)}'s HP to:`, '', String(hpNow));
                if (v === null || v === '' || isNaN(Number(v))) return;
                sendBattleCommand('summon', { action: 'hp', hp: Math.round(Number(v)), ...target }, `Set ${n} to ${Math.round(Number(v))} HP`);
            }],
            ['bi-bandaid', 'Heal to full', () => sendBattleCommand('summon', { action: 'heal', ...target }, `Healed ${n}`)],
            ['bi-arrow-return-left', 'Return to hand', () => sendBattleCommand('summon', { action: 'toHand', ...target }, `Returned ${n} to hand`)],
            ['bi-hurricane', 'Banish', () => sendBattleCommand('summon', { action: 'banish', ...target }, `Banished ${n}`)],
        ],
        reaction: [
            ['bi-x-octagon', 'Destroy', () => sendBattleCommand('reaction', { action: 'destroy', ...target }, `Destroyed ${n}`), 'danger'],
            ['bi-arrow-return-left', 'Return to hand', () => sendBattleCommand('reaction', { action: 'toHand', ...target }, `Returned ${n} to hand`)],
            ['bi-hurricane', 'Banish', () => sendBattleCommand('reaction', { action: 'banish', ...target }, `Banished ${n}`)],
        ],
        hand: [
            ['bi-trash3', 'Discard', () => sendBattleCommand('hand', { action: 'discard', ...target }, `Discarded ${n}`), 'danger'],
            ['bi-hurricane', 'Banish', () => sendBattleCommand('hand', { action: 'banish', ...target }, `Banished ${n}`)],
            ['bi-arrow-bar-up', 'Put on top of deck', () => sendBattleCommand('hand', { action: 'deckTop', ...target }, `Put ${n} on top of their deck`)],
            ['bi-shuffle', 'Shuffle into deck', () => sendBattleCommand('hand', { action: 'deckShuffle', ...target }, `Shuffled ${n} into their deck`)],
        ],
        graveyard: [
            ['bi-arrow-return-left', 'Return to hand', () => sendBattleCommand('graveyard', { action: 'toHand', ...target }, `Returned ${n} to hand`)],
            ['bi-shuffle', 'Shuffle into deck', () => sendBattleCommand('graveyard', { action: 'deckShuffle', ...target }, `Shuffled ${n} into their deck`)],
            ['bi-hurricane', 'Banish', () => sendBattleCommand('graveyard', { action: 'banish', ...target }, `Banished ${n}`)],
        ],
        banish: [],
        deckTop: [],
    }[zone] || [];

    specMenuEl = document.createElement('div');
    specMenuEl.className = 'spec-menu';
    specMenuEl.setAttribute('role', 'menu');
    specMenuEl.innerHTML = `<div class="spec-menu-title">${escapeHTML(n)}</div>
        <button type="button" role="menuitem" data-i="view"><i class="bi bi-eye"></i> View card</button>
        ${items.map(([icon, label, , cls], i) => `<button type="button" role="menuitem" class="${cls || ''}" data-i="${i}"><i class="bi ${icon}"></i> ${label}</button>`).join('')}`;
    specMenuEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        e.stopPropagation();
        closeSpecMenu();
        if (btn.dataset.i === 'view') openInCardViewModal(cardId);
        else items[Number(btn.dataset.i)][2]();
    });
    document.body.append(specMenuEl);
    const r = tile.getBoundingClientRect(), m = specMenuEl.getBoundingClientRect();
    const left = r.right + 8 + m.width < window.innerWidth ? r.right + 8 : Math.max(8, r.left - 8 - m.width);
    specMenuEl.style.left = `${left}px`;
    specMenuEl.style.top = `${Math.max(8, Math.min(r.top, window.innerHeight - m.height - 8))}px`;
    specMenuEl.querySelector('button')?.focus({ preventScroll: true });
}
