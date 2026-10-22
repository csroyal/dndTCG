/* ============================================================
   ADMIN SECTION — manage every player's collection (admins only).

   Writes touch only the fields that change ("binder.<id>", "goldenTickets.<pack>"), never a
   whole binder, and each player's client merges remote changes live (watchOwnProfile in
   util.js), so a gift can't be overwritten by that player's next save.
   Every change is recorded in the player's `adminLog` and can be reverted from Activity.
   Changes made with a gift note also land in the player's `gifts` list, which their client
   shows as a pop-up and then clears (scripts/gifts.js).
============================================================ */

const ADMIN_LOG_LIMIT = 150;
const GIFT_LIMIT = 20;
const RARITIES = ['Common', 'Rare', 'Legendary', 'Mythic'];
const adminUserList = document.getElementById('adminUserList');
const adminDetail = document.getElementById('adminDetail');
const adminUserSearch = document.getElementById('adminUserSearch');
const adminSelectAll = document.getElementById('adminSelectAll');
const adminSelectedCount = document.getElementById('adminSelectedCount');

const admin = {
    users: [],            // [{ id, data }]
    focusedId: null,
    checked: new Set(),
    tab: 'overview',
    give: { query: '', cardId: null, qty: 1, packId: '', copies: 1 },
    coll: { query: '', packId: '', ownedOnly: false },
    gift: { enabled: true, message: '' },
    drop: { rows: [{ count: 3, rarity: 'Rare', packId: '' }], preferNew: true, presetId: '', boosterPack: '' },
    writeQueue: {},       // per-player promise chain so rapid clicks apply in order
};

/* ---------- Helpers ---------- */

const adminUser = (id) => admin.users.find(u => u.id === id);
const adminName = (id) => adminUser(id)?.data.name || id;
const cardName = (id) => getObjectById(cards, id)?.name || id;
const packName = (id) => getObjectById(packs, id)?.name || id;
const binderPacks = () => packs.filter(p => p.showInBinder);
const ticketPacks = () => packs.filter(p => p.canBuyFromShop);

function timeAgo(ms) {
    if (!ms) return 'never';
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
    return new Date(ms).toLocaleDateString();
}

function userStats(data) {
    const ids = binderCardIds();
    const b = data.binder || {};
    const owned = ids.filter(id => (b[id] || 0) > 0).length;
    return {
        owned, total: ids.length, pct: ids.length ? Math.round((owned / ids.length) * 100) : 0,
        copies: Object.values(b).reduce((a, n) => a + (n || 0), 0),
        decks: (data.decks || []).length,
        tickets: Object.values(data.goldenTickets || {}).reduce((a, n) => a + (n || 0), 0),
        sleeve: Object.values(data.sleeve || {}).reduce((a, n) => a + (n || 0), 0),
    };
}

function avatarHTML(data, size = 36) {
    if (data.profilePictureURL) return `<img class="admin-avatar" style="width:${size}px;height:${size}px" src="${escapeHTML(data.profilePictureURL)}" alt="">`;
    const name = data.name || '?';
    const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
    return `<span class="admin-avatar" style="width:${size}px;height:${size}px;background:hsl(${hue} 45% 45%)">${escapeHTML(name[0].toUpperCase())}</span>`;
}

// Who the Give / Golden Ticket tools act on: the ticked players, or else the one being viewed.
function adminTargets() {
    return admin.checked.size ? [...admin.checked] : (admin.focusedId ? [admin.focusedId] : []);
}

function describeChanges(changes) {
    const parts = [];
    for (const [id, n] of Object.entries(changes.binder || {})) parts.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} ${cardName(id)}`);
    for (const [id, n] of Object.entries(changes.goldenTickets || {})) parts.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} ticket (${packName(id)})`);
    const blisterWord = { ready: 'unopened', opened: 'opened', locked: 'none' };
    for (const [id, [before, after]] of Object.entries(changes.blisters || {})) parts.push(`${blisterName(id)}: ${blisterWord[before]} → ${blisterWord[after]}`);
    return parts;
}

/* ---------- Writing ---------- */

// Apply a delta to one player. `delta` is { binder: {id: n}, goldenTickets: {pack: n} } or a function of
// the player's fresh data returning one. Counts never drop below 0; decks are trimmed to match.
function adminApply(userId, delta, text, { revertOf = null, gift = null } = {}) {
    const run = async () => {
        const ref = db.collection('profiles').doc(userId);
        const doc = await ref.get();
        if (!doc.exists) throw new Error(`${userId} no longer exists`);
        const data = doc.data();
        const d = typeof delta === 'function' ? delta(data) : delta;
        const FV = firebase.firestore.FieldValue;
        const binderNow = { ...(data.binder || {}) }, ticketsNow = { ...(data.goldenTickets || {}) };
        const update = {}, applied = { binder: {}, goldenTickets: {} };

        for (const [field, current, changes] of [['binder', binderNow, d.binder], ['goldenTickets', ticketsNow, d.goldenTickets]]) {
            for (const [key, n] of Object.entries(changes || {})) {
                const before = current[key] || 0, after = Math.max(0, before + n);
                if (after === before) continue;
                applied[field][key] = after - before;
                if (after > 0) current[key] = after; else delete current[key];
                update[`${field}.${key}`] = after > 0 ? after : FV.delete();
            }
        }
        // blisters are states, not counts: d.blisters = { promoId: 'ready' | 'opened' | 'locked' }
        const blistersNow = { ...(data.blisters || {}) };
        applied.blisters = {};
        for (const [promo, target] of Object.entries(d.blisters || {})) {
            const before = blisterState(promo, blistersNow);
            if (before === target) continue;
            applied.blisters[promo] = [before, target];
            if (target === 'locked') delete blistersNow[promo];
            else blistersNow[promo] = { ...(blistersNow[promo] || {}), opened: target === 'opened', at: Date.now(), from: currentProfile };
            update[`blisters.${promo}`] = target === 'locked' ? FV.delete() : blistersNow[promo];
        }
        if (!Object.keys(applied.binder).length && !Object.keys(applied.goldenTickets).length && !Object.keys(applied.blisters).length) return null;

        // no deck may hold more copies than the player now owns
        let decks = data.decks || [], decksTrimmed = false;
        const lowered = Object.keys(applied.binder).filter(id => applied.binder[id] < 0);
        if (lowered.length) {
            decks = decks.map(deck => {
                const list = { ...deck.deckList };
                let icon = deck.icon;
                for (const id of lowered) {
                    if ((list[id] || 0) <= (binderNow[id] || 0)) continue;
                    if (binderNow[id]) list[id] = binderNow[id]; else delete list[id];
                    if (icon === id && !list[id]) icon = null;
                    decksTrimmed = true;
                }
                return { ...deck, deckList: list, icon };
            });
            if (decksTrimmed) update.decks = decks;
        }

        const entry = { id: generateUID(), at: Date.now(), by: currentProfile, text, changes: applied };
        if (revertOf) entry.revertOf = revertOf;
        const log = (data.adminLog || []).map(e => e.id === revertOf ? { ...e, reverted: true } : e);
        update.adminLog = [...log, entry].slice(-ADMIN_LOG_LIMIT);

        // Only additions are worth a pop-up; a gift note on a removal is just ignored.
        const gave = Object.values(applied.binder).some(n => n > 0) || Object.values(applied.goldenTickets).some(n => n > 0)
            || Object.values(applied.blisters).some(([, after]) => after === 'ready');
        if (gift && gave) {
            update.gifts = [...(data.gifts || []), { id: entry.id, at: entry.at, from: currentProfile, message: gift.message || '', title: text, changes: applied }].slice(-GIFT_LIMIT);
        }

        await ref.update(update);
        const user = adminUser(userId);
        if (user) user.data = { ...data, binder: binderNow, goldenTickets: ticketsNow, blisters: blistersNow, decks, adminLog: update.adminLog, gifts: update.gifts ?? data.gifts };
        return { entry, decksTrimmed };
    };
    const next = (admin.writeQueue[userId] || Promise.resolve()).then(run, run);
    admin.writeQueue[userId] = next.catch(() => {});
    return next;
}

// The gift note from the Give / Golden Tickets tabs, or null when gifting is switched off.
function adminGiftOption() {
    return admin.gift.enabled ? { message: admin.gift.message.trim() } : null;
}

async function adminApplyToTargets(delta, text, successMsg, { gift = null, describe = null } = {}) {
    const targets = adminTargets();
    if (!targets.length) return;
    const results = await Promise.allSettled(targets.map(id => adminApply(id, delta, text, { gift })));
    const failed = results.filter(r => r.status === 'rejected');
    const changed = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const trimmed = results.some(r => r.status === 'fulfilled' && r.value?.decksTrimmed);
    if (failed.length) {
        console.error('admin write failed', failed.map(f => f.reason));
        showToast(`Couldn't update ${failed.length} player${failed.length === 1 ? '' : 's'}.`, 'error');
    }
    if (changed) {
        const who = targets.length === 1 ? adminName(targets[0]) : `${changed} players`;
        // a single roll is worth naming ("Rolled Hydra, Wolf → Bob")
        const detail = describe && targets.length === 1 && results[0].value ? describe(results[0].value.entry.changes) : '';
        showToast(`${detail || successMsg} → ${who}.${gift ? ' Sent as a gift.' : ''}${trimmed ? ' Decks trimmed to match.' : ''}`, 'success');
    } else if (!failed.length) {
        showToast('Nothing to change.', 'info');
    }
    renderUserList();
    renderAdminDetail();
}

/* ---------- Loading ---------- */

async function loadAdminUsers() {
    if (!isAdmin) return;
    adminUserList.innerHTML = '<div class="empty-state">Loading players…</div>';
    try {
        const snap = await db.collection('profiles').get();
        const users = [];
        snap.forEach(doc => users.push({ id: doc.id, data: doc.data() }));
        users.sort((a, b) => (a.data.name || a.id).localeCompare(b.data.name || b.id));
        admin.users = users;
        for (const id of [...admin.checked]) if (!adminUser(id)) admin.checked.delete(id);
        if (!adminUser(admin.focusedId)) admin.focusedId = users.find(u => u.id === toKebabCase(currentProfile || ''))?.id ?? users[0]?.id ?? null;
        renderUserList();
        renderAdminDetail();
    } catch (err) {
        console.error(err);
        adminUserList.innerHTML = '<div class="empty-state">Couldn\'t load players.</div>';
    }
}

/* ---------- Player list ---------- */

function renderUserList() {
    const q = adminUserSearch.value.trim().toLowerCase();
    const me = toKebabCase(currentProfile || '');
    const shown = admin.users.filter(u => !q || (u.data.name || u.id).toLowerCase().includes(q));
    adminUserList.innerHTML = '';
    if (!shown.length) adminUserList.innerHTML = '<div class="empty-state">No players match.</div>';
    for (const u of shown) {
        const st = userStats(u.data);
        const row = document.createElement('div');
        row.className = 'admin-user' + (u.id === admin.focusedId ? ' focused' : '') + (admin.checked.has(u.id) ? ' checked' : '');
        row.innerHTML = `
            <input type="checkbox" class="admin-user-check" aria-label="Select ${escapeHTML(u.data.name || u.id)}" ${admin.checked.has(u.id) ? 'checked' : ''}>
            ${avatarHTML(u.data)}
            <div class="admin-user-info">
                <div class="admin-user-name">${escapeHTML(u.data.name || u.id)}
                    ${u.data.isAdmin ? '<span class="admin-chip">Admin</span>' : ''}
                    ${u.id === me ? '<span class="admin-chip you">You</span>' : ''}
                </div>
                <div class="admin-user-meta">${st.owned}/${st.total} cards · ${st.decks} deck${st.decks === 1 ? '' : 's'}${st.tickets ? ` · <i class="bi bi-ticket-perforated-fill"></i> ${st.tickets}` : ''}</div>
                <div class="admin-user-seen">Seen ${timeAgo(u.data.lastSeen)}</div>
            </div>`;
        row.querySelector('.admin-user-check').addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.checked) admin.checked.add(u.id); else admin.checked.delete(u.id);
            renderUserList();
            renderAdminDetail();
        });
        row.addEventListener('click', () => { admin.focusedId = u.id; renderUserList(); renderAdminDetail(); });
        makeActivatable(row, `View ${u.data.name || u.id}`);
        adminUserList.append(row);
    }
    adminSelectedCount.textContent = admin.checked.size ? `${admin.checked.size} selected` : '';
    adminSelectAll.checked = admin.users.length > 0 && admin.checked.size === admin.users.length;
    adminSelectAll.indeterminate = admin.checked.size > 0 && admin.checked.size < admin.users.length;
}

adminUserSearch.addEventListener('input', renderUserList);
adminSelectAll.addEventListener('change', () => {
    admin.checked = adminSelectAll.checked ? new Set(admin.users.map(u => u.id)) : new Set();
    renderUserList();
    renderAdminDetail();
});

/* ---------- Detail panel ---------- */

const ADMIN_TABS = [
    ['overview', 'Overview', 'bi-person-badge'],
    ['give', 'Give Cards', 'bi-gift'],
    ['collection', 'Collection', 'bi-collection'],
    ['tickets', 'Golden Tickets', 'bi-ticket-perforated'],
    ['blisters', 'Blisters', 'bi-postcard-heart'],
    ['activity', 'Activity', 'bi-clock-history'],
];

function renderAdminDetail() {
    const user = adminUser(admin.focusedId);
    if (!user) { adminDetail.innerHTML = '<div class="empty-state">Pick a player on the left.</div>'; return; }
    const st = userStats(user.data);
    const targets = adminTargets();
    const multi = admin.checked.size > 0;

    adminDetail.innerHTML = `
        <header class="admin-detail-head">
            ${avatarHTML(user.data, 52)}
            <div>
                <h2>${escapeHTML(user.data.name || user.id)} ${user.data.isAdmin ? '<span class="admin-chip">Admin</span>' : ''}</h2>
                <div class="admin-user-seen">Last seen ${timeAgo(user.data.lastSeen)}</div>
            </div>
            <div class="admin-detail-stats">
                <span><strong>${st.owned}</strong>/${st.total} cards</span>
                <span><strong>${st.copies}</strong> copies</span>
                <span><strong>${st.tickets}</strong> ticket${st.tickets === 1 ? '' : 's'}</span>
            </div>
        </header>
        ${multi ? `<div class="admin-target-banner"><i class="bi bi-people-fill"></i>
            <span>Give Cards and Golden Tickets apply to <strong>${targets.length} player${targets.length === 1 ? '' : 's'}</strong>: ${targets.map(id => escapeHTML(adminName(id))).join(', ')}</span>
            <button type="button" class="btn-ghost admin-clear-selection">Clear</button></div>` : ''}
        <nav class="admin-tabs" role="tablist">
            ${ADMIN_TABS.map(([key, label, icon]) => `<button type="button" role="tab" data-tab="${key}" aria-selected="${admin.tab === key}" class="${admin.tab === key ? 'active' : ''}"><i class="bi ${icon}"></i> ${label}</button>`).join('')}
        </nav>
        <div class="admin-tab-body"></div>`;

    adminDetail.querySelector('.admin-clear-selection')?.addEventListener('click', () => { admin.checked.clear(); renderUserList(); renderAdminDetail(); });
    adminDetail.querySelectorAll('.admin-tabs button').forEach(btn => btn.addEventListener('click', () => { admin.tab = btn.dataset.tab; renderAdminDetail(); }));
    const body = adminDetail.querySelector('.admin-tab-body');
    ({ overview: renderOverviewTab, give: renderGiveTab, collection: renderCollectionTab, tickets: renderTicketsTab, blisters: renderBlistersTab, activity: renderActivityTab })[admin.tab](body, user);
}

/* ---- Overview ---- */

function renderOverviewTab(body, user) {
    const b = user.data.binder || {};
    const me = user.id === toKebabCase(currentProfile || '');
    body.innerHTML = `
        <div class="admin-grid-2">
            <div class="admin-card">
                <h3>Sets</h3>
                ${binderPacks().map(pack => {
                    const total = pack.cardPool.length, owned = pack.cardPool.filter(id => (b[id] || 0) > 0).length;
                    return `<div class="admin-set-row"><span>${escapeHTML(pack.name)}</span>
                        <div class="pack-progress-bar"><div class="pack-progress-fill${owned === total ? ' complete' : ''}" style="width:${total ? owned / total * 100 : 0}%"></div></div>
                        <span class="admin-set-count">${owned}/${total}</span></div>`;
                }).join('')}
            </div>
            <div class="admin-card">
                <h3>Decks</h3>
                ${(user.data.decks || []).length ? (user.data.decks || []).map(deck => {
                    const n = Object.values(deck.deckList || {}).reduce((a, c) => a + c, 0);
                    return `<div class="admin-deck-row">${deck.icon ? `<img src="./assets/card-art/${escapeHTML(deck.icon)}.jpg" alt="">` : '<span class="admin-deck-blank"></span>'}
                        <span>${escapeHTML(deck.name)}</span><span class="admin-set-count${n >= DECK_LIMIT ? ' full' : ''}">${n}/${DECK_LIMIT}</span></div>`;
                }).join('') : '<p class="admin-muted">No decks yet.</p>'}
                <h3 class="admin-subhead">Account</h3>
                <div class="admin-account-row">
                    <div><strong>Admin access</strong><p class="admin-muted">Admins can open this page and the dev panel.</p></div>
                    <button type="button" class="${user.data.isAdmin ? 'danger' : 'btn-accent'} admin-toggle-admin" ${me ? 'disabled title="You can\'t remove your own admin access"' : ''}>
                        ${user.data.isAdmin ? 'Remove admin' : 'Make admin'}</button>
                </div>
            </div>
        </div>`;
    body.querySelector('.admin-toggle-admin')?.addEventListener('click', async () => {
        const grant = !user.data.isAdmin;
        const ok = await showConfirm(grant
            ? `Give <strong>${escapeHTML(user.data.name || user.id)}</strong> admin access?`
            : `Remove admin access from <strong>${escapeHTML(user.data.name || user.id)}</strong>?`,
            { confirmLabel: grant ? 'Make Admin' : 'Remove Admin', danger: !grant });
        if (!ok) return;
        try {
            await db.collection('profiles').doc(user.id).update({ isAdmin: grant });
            user.data.isAdmin = grant;
            showToast(`${user.data.name || user.id} ${grant ? 'is now an admin' : 'is no longer an admin'}.`, 'success');
            renderUserList(); renderAdminDetail();
        } catch (err) { console.error(err); showToast('Couldn\'t change admin access.', 'error'); }
    });
}

/* ---- Give cards ---- */

// The gift-note box shared by the Give Cards and Golden Tickets tabs.
function giftNoteHTML() {
    const gn = admin.gift;
    return `
        <div class="admin-card admin-gift-note">
            <label class="admin-gift-toggle"><input type="checkbox" class="admin-gift-enabled" ${gn.enabled ? 'checked' : ''}>
                <span><i class="bi bi-envelope-heart"></i> <strong>Send as a gift</strong> <span class="admin-muted">The player gets a pop-up showing what arrived.</span></span></label>
            <textarea class="admin-gift-message" rows="2" maxlength="280" placeholder="Add a note, e.g. &quot;Spoils from the dragon's hoard!&quot;" ${gn.enabled ? '' : 'disabled'}>${escapeHTML(gn.message)}</textarea>
        </div>`;
}

function bindGiftNote(body) {
    const toggle = body.querySelector('.admin-gift-enabled');
    const msg = body.querySelector('.admin-gift-message');
    toggle.addEventListener('change', () => { admin.gift.enabled = toggle.checked; msg.disabled = !toggle.checked; });
    msg.addEventListener('input', () => { admin.gift.message = msg.value; });
}

function renderGiveTab(body, user) {
    const g = admin.give;
    const single = adminTargets().length === 1;
    const ownedBy = (id) => single ? ((adminUser(adminTargets()[0])?.data.binder || {})[id] || 0) : null;
    if (!g.packId) g.packId = binderPacks()[0]?.id || '';

    body.innerHTML = `
        ${giftNoteHTML()}
        <div class="admin-grid-2">
            <div class="admin-card">
                <h3>Give a card</h3>
                <input type="search" class="admin-give-search" placeholder="Search cards by name" value="${escapeHTML(g.query)}">
                <div class="admin-card-results"></div>
                <div class="admin-give-row" ${g.cardId ? '' : 'hidden'}>
                    <img class="admin-give-preview" alt="">
                    <div class="admin-give-picked">
                        <strong class="admin-give-name"></strong>
                        <span class="admin-muted admin-give-owned"></span>
                        <div class="admin-qty">
                            <button type="button" data-q="-1" aria-label="One fewer">−</button>
                            <input type="number" min="1" max="99" value="${g.qty}" aria-label="Copies">
                            <button type="button" data-q="1" aria-label="One more">+</button>
                        </div>
                    </div>
                    <button type="button" class="btn-accent admin-give-go"><i class="bi bi-gift"></i> Give</button>
                </div>
            </div>
            <div class="admin-card">
                <h3>Give a whole set</h3>
                <select class="admin-set-select">${binderPacks().map(p => `<option value="${p.id}" ${p.id === g.packId ? 'selected' : ''}>${escapeHTML(p.name)} (${p.cardPool.length})</option>`).join('')}</select>
                <label class="admin-inline">Copies of each <input type="number" class="admin-set-copies" min="1" max="10" value="${g.copies}"></label>
                <div class="admin-set-buttons">
                    <button type="button" class="btn-accent admin-set-all"><i class="bi bi-collection-fill"></i> Give every card</button>
                    <button type="button" class="admin-set-missing"><i class="bi bi-patch-plus"></i> Fill missing only</button>
                </div>
                <p class="admin-muted">"Fill missing" gives 1 copy of each card the player doesn't own yet, and nothing else.</p>
            </div>
        </div>
        <div class="admin-drop-host"></div>`;
    bindGiftNote(body);
    renderDropTables(body.querySelector('.admin-drop-host'));

    const search = body.querySelector('.admin-give-search');
    const results = body.querySelector('.admin-card-results');
    const row = body.querySelector('.admin-give-row');
    const qtyInput = row.querySelector('input');

    const showPicked = () => {
        if (!g.cardId) { row.hidden = true; return; }
        const card = getObjectById(cards, g.cardId);
        row.hidden = false;
        row.querySelector('.admin-give-preview').src = `./assets/card-art/${card.id}.jpg`;
        row.querySelector('.admin-give-name').textContent = card.name;
        row.querySelector('.admin-give-owned').textContent = `${card.rarity} ${card.class}${single ? ` · owns ${ownedBy(card.id)}` : ''}`;
    };
    const renderResults = () => {
        const q = g.query.trim().toLowerCase();
        if (!q) { results.innerHTML = ''; return; }
        const hits = cards.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
        results.innerHTML = hits.length ? '' : '<p class="admin-muted">No cards match.</p>';
        for (const c of hits) {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'admin-card-result' + (c.id === g.cardId ? ' picked' : '');
            opt.innerHTML = `<img src="./assets/card-art/${c.id}.jpg" alt="" loading="lazy"><span>${escapeHTML(c.name)}</span>
                <span class="admin-rarity rarity-${c.rarity.toLowerCase()}">${c.rarity}</span>${single ? `<span class="admin-muted">×${ownedBy(c.id)}</span>` : ''}`;
            opt.addEventListener('click', () => { g.cardId = c.id; renderResults(); showPicked(); });
            results.append(opt);
        }
    };
    search.addEventListener('input', () => { g.query = search.value; renderResults(); });
    row.querySelectorAll('[data-q]').forEach(btn => btn.addEventListener('click', () => {
        g.qty = Math.max(1, Math.min(99, (parseInt(qtyInput.value, 10) || 1) + Number(btn.dataset.q)));
        qtyInput.value = g.qty;
    }));
    qtyInput.addEventListener('change', () => { g.qty = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1)); qtyInput.value = g.qty; });
    row.querySelector('.admin-give-go').addEventListener('click', () => {
        if (!g.cardId) return;
        const name = cardName(g.cardId);
        adminApplyToTargets({ binder: { [g.cardId]: g.qty } }, `Gave ${g.qty}× ${name}`, `Gave ${g.qty}× ${name}`, { gift: adminGiftOption() });
    });
    renderResults();
    showPicked();

    body.querySelector('.admin-set-select').addEventListener('change', (e) => { g.packId = e.target.value; });
    body.querySelector('.admin-set-copies').addEventListener('change', (e) => { g.copies = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)); e.target.value = g.copies; });
    body.querySelector('.admin-set-all').addEventListener('click', async () => {
        const pack = getObjectById(packs, g.packId);
        const ok = await showConfirm(`Give <strong>${g.copies}</strong> of every <strong>${escapeHTML(pack.name)}</strong> card (${pack.cardPool.length} cards) to ${adminTargets().length === 1 ? escapeHTML(adminName(adminTargets()[0])) : `${adminTargets().length} players`}?`,
            { confirmLabel: 'Give Set', danger: false });
        if (!ok) return;
        const delta = { binder: Object.fromEntries(pack.cardPool.map(id => [id, g.copies])) };
        adminApplyToTargets(delta, `Gave every ${pack.name} card (${g.copies} each)`, `Gave the ${pack.name} set`, { gift: adminGiftOption() });
    });
    body.querySelector('.admin-set-missing').addEventListener('click', () => {
        const pack = getObjectById(packs, g.packId);
        let count = 0;
        const delta = (data) => {
            const missing = pack.cardPool.filter(id => !((data.binder || {})[id] > 0));
            count = missing.length;
            return { binder: Object.fromEntries(missing.map(id => [id, 1])) };
        };
        adminApplyToTargets(delta, `Filled missing ${pack.name} cards`, `Filled missing ${pack.name} cards`, { gift: adminGiftOption() });
    });
}

/* ---- Drop tables ---- */

// Presets live on the admin's own profile, so they follow you between devices.
function myProfileId() { return toKebabCase(currentProfile || ''); }
function dropPresets() { return adminUser(myProfileId())?.data.dropTables || []; }

async function saveDropPresets(list) {
    await db.collection('profiles').doc(myProfileId()).update({ dropTables: list });
    const me = adminUser(myProfileId());
    if (me) me.data.dropTables = list;
}

function describeDropRows(rows) {
    return rows.map(r => `${r.count} ${r.rarity || 'random'}${r.packId ? ` from ${packName(r.packId)}` : ''}`).join(' + ');
}

// Roll a drop table for one player. Each row draws `count` cards of its rarity from its set (or every set).
// With preferNew, cards the player doesn't own (and hasn't just rolled) come first; duplicates only once those run out.
function rollDrop(rows, preferNew, data) {
    const owned = data.binder || {};
    const rolled = {};
    for (const row of rows) {
        const poolIds = row.packId ? getObjectById(packs, row.packId).cardPool : binderCardIds();
        const pool = [...new Set(poolIds)].map(id => getObjectById(cards, id)).filter(c => c && (!row.rarity || c.rarity === row.rarity));
        if (!pool.length) continue;
        for (let i = 0; i < row.count; i++) {
            const fresh = preferNew ? pool.filter(c => !(owned[c.id] > 0) && !rolled[c.id]) : [];
            const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
            rolled[pick.id] = (rolled[pick.id] || 0) + 1;
        }
    }
    return { binder: rolled };
}

// A full booster with the pack's real odds (generatePack in home.js); a Golden Ticket pull becomes a ticket.
function rollBooster(packId) {
    const result = { binder: {}, goldenTickets: {} };
    for (const id of generatePack(packId)) {
        if (id === 'GT') result.goldenTickets[packId] = (result.goldenTickets[packId] || 0) + 1;
        else result.binder[id] = (result.binder[id] || 0) + 1;
    }
    return result;
}

function rolledNames(changes) {
    const parts = Object.entries(changes.binder || {}).map(([id, n]) => `${n > 1 ? `${n}× ` : ''}${cardName(id)}`);
    const tickets = Object.values(changes.goldenTickets || {}).reduce((a, n) => a + n, 0);
    if (tickets) parts.push(`${tickets} Golden Ticket${tickets === 1 ? '' : 's'}`);
    return parts.length && parts.length <= 6 ? `Rolled ${parts.join(', ')}` : '';
}

function renderDropTables(host) {
    const dr = admin.drop;
    const presets = dropPresets();
    if (dr.presetId && !presets.some(p => p.id === dr.presetId)) dr.presetId = '';
    if (!dr.boosterPack) dr.boosterPack = ticketPacks()[0]?.id || '';
    const setOptions = (sel) => `<option value="">Any set</option>${binderPacks().map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${escapeHTML(p.name)}</option>`).join('')}`;
    const rarityOptions = (sel) => `<option value="">Any rarity</option>${RARITIES.map(r => `<option ${r === sel ? 'selected' : ''}>${r}</option>`).join('')}`;

    host.innerHTML = `
        <div class="admin-grid-2 admin-drop-grid">
            <div class="admin-card">
                <h3><i class="bi bi-dice-5"></i> Drop table</h3>
                <div class="admin-drop-presets">
                    <select class="admin-drop-preset" aria-label="Drop table preset">
                        <option value="">Custom drop</option>
                        ${presets.map(p => `<option value="${p.id}" ${p.id === dr.presetId ? 'selected' : ''}>${escapeHTML(p.name)}</option>`).join('')}
                    </select>
                    <button type="button" class="btn-ghost admin-drop-save"><i class="bi bi-bookmark-plus"></i> ${dr.presetId ? 'Update' : 'Save as preset'}</button>
                    ${dr.presetId ? '<button type="button" class="btn-ghost admin-drop-delete" aria-label="Delete preset"><i class="bi bi-trash"></i></button>' : ''}
                </div>
                <div class="admin-drop-rows">
                    ${dr.rows.map((row, i) => `
                        <div class="admin-drop-row" data-i="${i}">
                            <input type="number" class="admin-drop-count" min="1" max="20" value="${row.count}" aria-label="How many">
                            <select class="admin-drop-rarity" aria-label="Rarity">${rarityOptions(row.rarity)}</select>
                            <select class="admin-drop-pack" aria-label="Set">${setOptions(row.packId)}</select>
                            <button type="button" class="btn-ghost admin-drop-remove" aria-label="Remove row" ${dr.rows.length === 1 ? 'disabled' : ''}><i class="bi bi-x-lg"></i></button>
                        </div>`).join('')}
                </div>
                <button type="button" class="btn-ghost admin-drop-add"><i class="bi bi-plus-lg"></i> Add row</button>
                <label class="admin-inline"><input type="checkbox" class="admin-drop-new" ${dr.preferNew ? 'checked' : ''}> Prefer cards the player doesn't own yet</label>
                <button type="button" class="btn-accent admin-drop-roll"><i class="bi bi-dice-5-fill"></i> Roll &amp; give</button>
                <p class="admin-muted">With several players selected, each one rolls separately.</p>
            </div>
            <div class="admin-card">
                <h3><i class="bi bi-box2-heart"></i> Open a booster for them</h3>
                <select class="admin-booster-pack">${ticketPacks().map(p => `<option value="${p.id}" ${p.id === dr.boosterPack ? 'selected' : ''}>${escapeHTML(p.name)}</option>`).join('')}</select>
                <p class="admin-muted">Rolls 6 cards with the pack's real odds, the same as opening one in the shop, including the rare Golden Ticket.</p>
                <button type="button" class="btn-accent admin-booster-go"><i class="bi bi-gift-fill"></i> Open &amp; give</button>
            </div>
        </div>`;

    const rerender = () => renderDropTables(host);
    host.querySelectorAll('.admin-drop-row').forEach(rowEl => {
        const row = dr.rows[Number(rowEl.dataset.i)];
        rowEl.querySelector('.admin-drop-count').addEventListener('change', (e) => { row.count = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)); e.target.value = row.count; });
        rowEl.querySelector('.admin-drop-rarity').addEventListener('change', (e) => { row.rarity = e.target.value; });
        rowEl.querySelector('.admin-drop-pack').addEventListener('change', (e) => { row.packId = e.target.value; });
        rowEl.querySelector('.admin-drop-remove').addEventListener('click', () => { dr.rows.splice(Number(rowEl.dataset.i), 1); rerender(); });
    });
    host.querySelector('.admin-drop-add').addEventListener('click', () => { dr.rows.push({ count: 1, rarity: '', packId: '' }); rerender(); });
    host.querySelector('.admin-drop-new').addEventListener('change', (e) => { dr.preferNew = e.target.checked; });

    host.querySelector('.admin-drop-preset').addEventListener('change', (e) => {
        dr.presetId = e.target.value;
        const preset = presets.find(p => p.id === dr.presetId);
        if (preset) { dr.rows = preset.rows.map(r => ({ ...r })); dr.preferNew = preset.preferNew !== false; }
        rerender();
    });
    host.querySelector('.admin-drop-save').addEventListener('click', async () => {
        const existing = presets.find(p => p.id === dr.presetId);
        const name = existing ? existing.name : await showInput('Name this drop table:', 'e.g. Boss loot', '', { type: 'text' });
        if (!name || !name.trim()) return;
        const preset = { id: existing?.id || generateUID(), name: name.trim().slice(0, 40), rows: dr.rows.map(r => ({ ...r })), preferNew: dr.preferNew };
        try {
            await saveDropPresets(existing ? presets.map(p => p.id === preset.id ? preset : p) : [...presets, preset]);
            dr.presetId = preset.id;
            showToast(`${existing ? 'Updated' : 'Saved'} "${preset.name}".`, 'success');
            rerender();
        } catch (err) { console.error(err); showToast('Couldn\'t save that preset.', 'error'); }
    });
    host.querySelector('.admin-drop-delete')?.addEventListener('click', async () => {
        const preset = presets.find(p => p.id === dr.presetId);
        if (!preset || !await showConfirm(`Delete the "<strong>${escapeHTML(preset.name)}</strong>" drop table?`, { confirmLabel: 'Delete' })) return;
        try {
            await saveDropPresets(presets.filter(p => p.id !== preset.id));
            dr.presetId = '';
            rerender();
        } catch (err) { console.error(err); showToast('Couldn\'t delete that preset.', 'error'); }
    });

    host.querySelector('.admin-drop-roll').addEventListener('click', () => {
        const rows = dr.rows.map(r => ({ ...r }));
        const preferNew = dr.preferNew;
        const label = presets.find(p => p.id === dr.presetId)?.name || describeDropRows(rows);
        adminApplyToTargets((data) => rollDrop(rows, preferNew, data), `Drop: ${label}`, `Rolled ${label}`,
            { gift: adminGiftOption(), describe: rolledNames });
    });
    host.querySelector('.admin-booster-pack').addEventListener('change', (e) => { dr.boosterPack = e.target.value; });
    host.querySelector('.admin-booster-go').addEventListener('click', () => {
        const packId = dr.boosterPack;
        adminApplyToTargets(() => rollBooster(packId), `Opened a ${packName(packId)} booster`, `Opened a ${packName(packId)} booster`,
            { gift: adminGiftOption(), describe: rolledNames });
    });
}

/* ---- Collection (one player) ---- */

function renderCollectionTab(body, user) {
    const c = admin.coll;
    body.innerHTML = `
        <div class="admin-coll-toolbar">
            <input type="search" class="admin-coll-search" placeholder="Search ${escapeHTML(user.data.name || user.id)}'s cards" value="${escapeHTML(c.query)}">
            <select class="admin-coll-pack"><option value="">All sets</option>${binderPacks().map(p => `<option value="${p.id}" ${p.id === c.packId ? 'selected' : ''}>${escapeHTML(p.name)}</option>`).join('')}</select>
            <button type="button" class="btn-ghost admin-coll-owned ${c.ownedOnly ? 'active' : ''}"><i class="bi bi-check2-square"></i> Owned only</button>
        </div>
        <p class="admin-muted">Changes save instantly. Lowering a count also trims that player's decks if needed.</p>
        <div class="admin-coll-grid"></div>`;

    const grid = body.querySelector('.admin-coll-grid');
    const draw = () => {
        const q = c.query.trim().toLowerCase();
        const b = user.data.binder || {};
        const pool = c.packId ? getObjectById(packs, c.packId).cardPool : binderCardIds();
        const list = [...new Set(pool)].map(id => getObjectById(cards, id)).filter(Boolean)
            .filter(card => (!q || card.name.toLowerCase().includes(q)) && (!c.ownedOnly || (b[card.id] || 0) > 0));
        grid.innerHTML = list.length ? '' : '<div class="empty-state">No cards match.</div>';
        for (const card of list) {
            const n = b[card.id] || 0;
            const tile = document.createElement('div');
            tile.className = 'admin-coll-tile' + (n ? '' : ' missing');
            tile.innerHTML = `<img src="./assets/card-art/${card.id}.jpg" alt="${escapeHTML(card.name)}" loading="lazy">
                <div class="admin-coll-name" title="${escapeHTML(card.name)}">${escapeHTML(card.name)}</div>
                <div class="admin-qty small">
                    <button type="button" data-d="-1" aria-label="Remove one ${escapeHTML(card.name)}" ${n ? '' : 'disabled'}>−</button>
                    <span>${n}</span>
                    <button type="button" data-d="1" aria-label="Add one ${escapeHTML(card.name)}">+</button>
                </div>`;
            tile.querySelectorAll('[data-d]').forEach(btn => btn.addEventListener('click', async () => {
                const d = Number(btn.dataset.d);
                tile.querySelectorAll('button').forEach(x => x.disabled = true);
                try {
                    const res = await adminApply(user.id, { binder: { [card.id]: d } }, `${d > 0 ? 'Added' : 'Removed'} 1× ${card.name}`);
                    if (res?.decksTrimmed) showToast(`Trimmed ${card.name} in ${user.data.name || user.id}'s decks.`, 'info');
                } catch (err) { console.error(err); showToast('Couldn\'t save that change.', 'error'); }
                const now = (user.data.binder || {})[card.id] || 0;
                tile.querySelector('span').textContent = now;
                tile.classList.toggle('missing', !now);
                tile.querySelector('[data-d="-1"]').disabled = !now;
                tile.querySelector('[data-d="1"]').disabled = false;
                renderUserList();
            }));
            grid.append(tile);
        }
    };
    body.querySelector('.admin-coll-search').addEventListener('input', (e) => { c.query = e.target.value; draw(); });
    body.querySelector('.admin-coll-pack').addEventListener('change', (e) => { c.packId = e.target.value; draw(); });
    body.querySelector('.admin-coll-owned').addEventListener('click', (e) => {
        c.ownedOnly = !c.ownedOnly;
        e.currentTarget.classList.toggle('active', c.ownedOnly);
        draw();
    });
    draw();
}

/* ---- Golden Tickets ---- */

function renderTicketsTab(body) {
    const targets = adminTargets();
    const single = targets.length === 1;
    const tickets = single ? (adminUser(targets[0])?.data.goldenTickets || {}) : {};
    body.innerHTML = `
        ${giftNoteHTML()}
        <div class="admin-card">
            <h3>Golden Tickets</h3>
            <p class="admin-muted">A ticket lets the player pick any one card from that pack.${single ? '' : ' + and − apply to every selected player.'}</p>
            ${ticketPacks().map(pack => `
                <div class="admin-ticket-row">
                    <img src="./assets/pack-art/${pack.id}-logo.png" alt="">
                    <span>${escapeHTML(pack.name)}</span>
                    <div class="admin-qty">
                        <button type="button" data-pack="${pack.id}" data-d="-1" aria-label="Remove a ${escapeHTML(pack.name)} ticket" ${single && !tickets[pack.id] ? 'disabled' : ''}>−</button>
                        <span>${single ? (tickets[pack.id] || 0) : '—'}</span>
                        <button type="button" data-pack="${pack.id}" data-d="1" aria-label="Give a ${escapeHTML(pack.name)} ticket">+</button>
                    </div>
                </div>`).join('')}
        </div>`;
    bindGiftNote(body);
    body.querySelectorAll('[data-pack]').forEach(btn => btn.addEventListener('click', () => {
        const d = Number(btn.dataset.d), pack = btn.dataset.pack;
        adminApplyToTargets({ goldenTickets: { [pack]: d } },
            `${d > 0 ? 'Gave' : 'Removed'} a Golden Ticket (${packName(pack)})`,
            `${d > 0 ? 'Gave' : 'Removed'} a ${packName(pack)} ticket`,
            { gift: d > 0 ? adminGiftOption() : null });
    }));
}

/* ---- Blisters ---- */

function renderBlistersTab(body) {
    const targets = adminTargets();
    const single = targets.length === 1;
    const promos = blisterPromos();
    const stateOf = (id, promo) => blisterState(promo, adminUser(id)?.data.blisters || {});
    const label = { locked: 'Not given', ready: 'Unopened', opened: 'Opened' };

    body.innerHTML = `
        ${giftNoteHTML()}
        <div class="admin-card">
            <h3>Blister Packs</h3>
            <p class="admin-muted">Each player can hold one of each blister, and it opens once. Giving one is the only way to get it; re-enable lets an opened blister be opened again.</p>
            ${promos.length ? promos.map(card => {
                const counts = { locked: 0, ready: 0, opened: 0 };
                targets.forEach(id => counts[stateOf(id, card.id)]++);
                const state = single ? stateOf(targets[0], card.id) : null;
                const summary = single ? label[state] : Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n} ${label[k].toLowerCase()}`).join(' · ');
                return `
                    <div class="admin-blister-row" data-promo="${card.id}">
                        ${blisterHTML(card.id, { className: 'mini' })}
                        <div class="admin-blister-info">
                            <strong>${escapeHTML(blisterName(card.id))}</strong>
                            <span class="admin-rarity rarity-${card.rarity.toLowerCase()}">${card.rarity} promo</span>
                            <span class="admin-blister-state state-${state || 'mixed'}">${summary}</span>
                        </div>
                        <div class="admin-blister-actions">
                            <button type="button" class="btn-accent" data-act="give" ${counts.locked ? '' : 'disabled'}><i class="bi bi-gift"></i> Give</button>
                            <button type="button" data-act="reenable" ${counts.opened ? '' : 'disabled'}><i class="bi bi-arrow-repeat"></i> Re-enable</button>
                            <button type="button" class="btn-ghost" data-act="takeback" ${counts.ready ? '' : 'disabled'}><i class="bi bi-x-circle"></i> Take back</button>
                        </div>
                    </div>`;
            }).join('') : '<p class="admin-muted">There are no Legendary or Mythic cards in the Promos set yet.</p>'}
        </div>`;
    bindGiftNote(body);

    body.querySelectorAll('.admin-blister-row').forEach(row => {
        const promo = row.dataset.promo, name = blisterName(promo);
        // each action only touches players in the matching state
        const act = (from, to, text, msg, gift = null) =>
            adminApplyToTargets((data) => blisterState(promo, data.blisters || {}) === from ? { blisters: { [promo]: to } } : {}, text, msg, { gift });
        row.querySelector('[data-act="give"]').addEventListener('click', () => act('locked', 'ready', `Gave the ${name}`, `Gave the ${name}`, adminGiftOption()));
        row.querySelector('[data-act="reenable"]').addEventListener('click', () => act('opened', 'ready', `Re-enabled the ${name}`, `Re-enabled the ${name}`));
        row.querySelector('[data-act="takeback"]').addEventListener('click', async () => {
            if (!await showConfirm(`Take back the unopened <strong>${escapeHTML(name)}</strong>?`, { confirmLabel: 'Take Back' })) return;
            act('ready', 'locked', `Took back the ${name}`, `Took back the ${name}`);
        });
    });
}

/* ---- Activity ---- */

function renderActivityTab(body, user) {
    const log = [...(user.data.adminLog || [])].reverse();
    body.innerHTML = `
        <div class="admin-card">
            <h3>Activity</h3>
            <p class="admin-muted">Every admin change to this account, newest first. Revert undoes exactly what that change did.</p>
            <div class="admin-log"></div>
        </div>`;
    const list = body.querySelector('.admin-log');
    if (!log.length) { list.innerHTML = '<div class="empty-state">No admin changes yet.</div>'; return; }
    for (const e of log) {
        const row = document.createElement('div');
        row.className = 'admin-log-row' + (e.reverted ? ' reverted' : '');
        const parts = describeChanges(e.changes || {});
        row.innerHTML = `
            <div class="admin-log-main">
                <strong>${escapeHTML(e.text)}</strong>
                <span class="admin-muted">${escapeHTML(e.by || 'Unknown')} · ${timeAgo(e.at)}${e.reverted ? ' · reverted' : ''}</span>
                ${parts.length > 1 ? `<details><summary>${parts.length} changes</summary><div class="admin-log-parts">${parts.map(p => `<span>${escapeHTML(p)}</span>`).join('')}</div></details>` : ''}
            </div>
            ${e.reverted || e.revertOf ? '' : '<button type="button" class="btn-ghost admin-revert"><i class="bi bi-arrow-counterclockwise"></i> Revert</button>'}`;
        row.querySelector('.admin-revert')?.addEventListener('click', async () => {
            const ok = await showConfirm(`Revert "<strong>${escapeHTML(e.text)}</strong>" for ${escapeHTML(user.data.name || user.id)}?`, { confirmLabel: 'Revert' });
            if (!ok) return;
            const inverse = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, n]) => [k, -n]));
            try {
                const blistersBack = Object.fromEntries(Object.entries(e.changes?.blisters || {}).map(([k, [before]]) => [k, before]));
                const res = await adminApply(user.id, { binder: inverse(e.changes?.binder), goldenTickets: inverse(e.changes?.goldenTickets), blisters: blistersBack },
                    `Reverted: ${e.text}`, { revertOf: e.id });
                showToast(res ? `Reverted "${e.text}".` : 'Nothing left to revert.', res ? 'success' : 'info');
            } catch (err) { console.error(err); showToast('Couldn\'t revert that change.', 'error'); }
            renderUserList(); renderAdminDetail();
        });
        list.append(row);
    }
}

/* ---------- Entry ---------- */

document.querySelector('#menu .menu-button[data-section="adminSection"]').addEventListener('click', loadAdminUsers);
document.getElementById('adminRefreshButton').addEventListener('click', loadAdminUsers);
