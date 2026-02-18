/**
 * Vôlei da Galera — app.js
 * Melhorias: estrelas nos tiers, onboarding, swipe-to-delete,
 * preview pré-sorteio, anti-repetição, confete
 */

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const STORAGE_KEY      = 'volei_app_data';
const ONBOARDING_KEY   = 'volei_onboarding_done';
const HISTORICO_KEY    = 'volei_historico_duplas';

const PESOS = { A: 100, B: 60, C: 20 };

// Exibição de tier para o usuário — apenas estrelas, sem rótulo revelador
const TIER_DISPLAY = { A: '⭐⭐⭐', B: '⭐⭐', C: '⭐' };
const TIER_TITLE   = { A: 'Avançado', B: 'Intermediário', C: 'Iniciante' };

const CORES_TIMES = [
    { nome: 'TIME A',     cor: '#2563eb' },
    { nome: 'TIME B', cor: '#dc2626' },
    { nome: 'TIME C',    cor: '#16a34a' },
    { nome: 'TIME D',  cor: '#d97706' },
];

// ─── ESTADO ──────────────────────────────────────────────────────────────────
let jogadores       = [];
let ordemAtual      = 'tier';   // 'tier' | 'nome'
let ultimosSorteados = null;    // { presentes, qtdTimes }
let editandoId      = null;
let historicoDuplas = {};       // { "idA-idB": contagem }

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────
window.onload = () => {
    carregarDados();
    verificarOnboarding();
    renderizarLista();
    atualizarPreview();

    document.getElementById('inputName').addEventListener('keydown', e => {
        if (e.key === 'Enter') adicionarJogador();
    });
    document.getElementById('editName').addEventListener('keydown', e => {
        if (e.key === 'Enter') salvarEdicao();
    });
};

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
function verificarOnboarding() {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
        document.getElementById('screen-onboarding').classList.remove('hidden');
    }
}

function fecharOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    const screen = document.getElementById('screen-onboarding');
    screen.style.transition = 'opacity 0.4s';
    screen.style.opacity = '0';
    setTimeout(() => screen.classList.add('hidden'), 400);
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function mostrarToast(msg, tipo = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast${tipo ? ` toast--${tipo}` : ''} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── DADOS ───────────────────────────────────────────────────────────────────
function carregarDados() {
    try {
        const d = localStorage.getItem(STORAGE_KEY);
        if (d) jogadores = JSON.parse(d);
        const h = localStorage.getItem(HISTORICO_KEY);
        if (h) historicoDuplas = JSON.parse(h);
    } catch (e) {
        console.error('Erro ao carregar dados', e);
        jogadores = []; historicoDuplas = {};
    }
}

function salvarDados() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jogadores));
    renderizarLista();
    atualizarPreview();
}

function salvarHistorico() {
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(historicoDuplas));
}

// ─── CRUD ────────────────────────────────────────────────────────────────────
function adicionarJogador() {
    const nomeInput = document.getElementById('inputName');
    const tierInput = document.getElementById('inputTier');
    const nome = nomeInput.value.trim();

    if (!nome) {
        mostrarToast('Digite um nome!', 'error');
        nomeInput.focus();
        return;
    }
    if (jogadores.some(j => j.nome.toLowerCase() === nome.toLowerCase())) {
        mostrarToast('Esse jogador já está na lista!', 'error');
        return;
    }

    jogadores.push({ id: Date.now(), nome, tier: tierInput.value, selecionado: true });
    nomeInput.value = '';
    nomeInput.focus();
    salvarDados();
    mostrarToast(`${nome} adicionado! 🏐`, 'success');
}

function removerJogador(id) {
    const j = jogadores.find(j => j.id === id);
    if (!j) return;
    jogadores = jogadores.filter(j => j.id !== id);
    salvarDados();
    mostrarToast(`${j.nome} removido.`);
}

function limparTudo() {
    if (!jogadores.length) return;
    mostrarConfirm('Apagar todos os jogadores?', () => {
        jogadores = [];
        historicoDuplas = {};
        salvarDados();
        salvarHistorico();
        mostrarToast('Lista limpa!');
    });
}

function toggleSelecionado(id) {
    const j = jogadores.find(j => j.id === id);
    if (j) { j.selecionado = !j.selecionado; salvarDados(); }
}

function toggleTodos(estado) {
    jogadores.forEach(j => j.selecionado = estado);
    salvarDados();
    mostrarToast(estado ? 'Todos selecionados ✓' : 'Todos desmarcados');
}

function alternarOrdem() {
    ordemAtual = ordemAtual === 'tier' ? 'nome' : 'tier';
    const btn = document.getElementById('btnOrdem');
    btn.innerHTML = ordemAtual === 'tier'
        ? '<i class="fas fa-arrow-down-a-z"></i>'
        : '<i class="fas fa-arrow-down-1-9"></i>';
    renderizarLista();
}

function stepTeams(delta) {
    const input = document.getElementById('numTeams');
    const val = parseInt(input.value) + delta;
    if (val < 2 || val > 4) return;
    input.value = val;
    atualizarPreview();
}

// ─── EDIÇÃO ──────────────────────────────────────────────────────────────────
function abrirModal(id) {
    const j = jogadores.find(j => j.id === id);
    if (!j) return;
    editandoId = id;
    document.getElementById('editName').value = j.nome;
    document.getElementById('editTier').value = j.tier;
    document.getElementById('edit-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('editName').focus(), 50);
}

function fecharModal() {
    editandoId = null;
    document.getElementById('edit-modal').classList.add('hidden');
    restaurarModal();
}

function salvarEdicao() {
    const nome = document.getElementById('editName').value.trim();
    const tier = document.getElementById('editTier').value;
    if (!nome) { mostrarToast('Nome não pode ser vazio!', 'error'); return; }

    const duplicado = jogadores.some(j => j.id !== editandoId && j.nome.toLowerCase() === nome.toLowerCase());
    if (duplicado) { mostrarToast('Já existe um jogador com esse nome!', 'error'); return; }

    const j = jogadores.find(j => j.id === editandoId);
    if (j) { j.nome = nome; j.tier = tier; }
    fecharModal();
    salvarDados();
    mostrarToast('Jogador atualizado! ✓', 'success');
}

document.addEventListener('click', e => {
    if (e.target === document.getElementById('edit-modal')) fecharModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fecharModal();
});

// ─── CONFIRM CUSTOMIZADO ─────────────────────────────────────────────────────
function mostrarConfirm(msg, onConfirm) {
    const overlay = document.getElementById('edit-modal');
    const box = overlay.querySelector('.modal-box');
    box.innerHTML = `
        <h3>${msg}</h3>
        <div class="modal-actions" style="margin-top:0.5rem">
            <button class="btn-modal-cancel" id="confirmNo">Cancelar</button>
            <button class="btn-modal-save" id="confirmYes" style="background:var(--danger)">Confirmar</button>
        </div>`;
    overlay.classList.remove('hidden');
    document.getElementById('confirmNo').onclick  = fecharModal;
    document.getElementById('confirmYes').onclick = () => { fecharModal(); onConfirm(); };
}

function restaurarModal() {
    document.querySelector('.modal-box').innerHTML = `
        <h3>Editar Jogador</h3>
        <input type="text" id="editName" placeholder="Nome do Jogador">
        <select id="editTier">
            <option value="C">⭐ Iniciante</option>
            <option value="B">⭐⭐ Intermediário</option>
            <option value="A">⭐⭐⭐ Avançado</option>
        </select>
        <div class="modal-actions">
            <button onclick="fecharModal()" class="btn-modal-cancel">Cancelar</button>
            <button onclick="salvarEdicao()" class="btn-modal-save">Salvar</button>
        </div>`;
    // Re-bind Enter key on restored input
    const inp = document.getElementById('editName');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') salvarEdicao(); });
}

// ─── PREVIEW PRÉ-SORTEIO ─────────────────────────────────────────────────────
function atualizarPreview() {
    const presentes = jogadores.filter(j => j.selecionado).length;
    const qtd       = parseInt(document.getElementById('numTeams').value) || 2;
    const preview   = document.getElementById('sortPreview');

    if (presentes === 0) {
        preview.innerHTML = 'selecione jogadores';
        return;
    }
    const porTime  = Math.floor(presentes / qtd);
    const sobra    = presentes % qtd;
    const detalhe  = sobra > 0
        ? `${porTime}-${porTime + 1} por time`
        : `${porTime} por time`;

    preview.innerHTML = `<strong>${presentes}</strong> jogadores · ${detalhe}`;
}

// ─── RENDERIZAÇÃO DA LISTA ────────────────────────────────────────────────────
function renderizarLista() {
    const lista    = document.getElementById('playerList');
    const total    = document.getElementById('totalPlayers');
    const selSpan  = document.getElementById('selectedCount');
    const bar      = document.getElementById('counterBar');
    const empty    = document.getElementById('empty-state');

    lista.innerHTML = '';
    total.textContent  = jogadores.length;
    const sel          = jogadores.filter(j => j.selecionado).length;
    selSpan.textContent = sel;
    bar.style.width    = jogadores.length ? `${(sel / jogadores.length) * 100}%` : '0%';

    if (!jogadores.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    const ordenados = [...jogadores].sort((a, b) => {
        if (ordemAtual === 'tier') {
            const ord = { A: 1, B: 2, C: 3 };
            return ord[a.tier] - ord[b.tier];
        }
        return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    ordenados.forEach(j => {
        // outer wrapper for swipe
        const wrapper = document.createElement('li');
        wrapper.className = 'swipe-wrapper';
        wrapper.dataset.id = j.id;

        wrapper.innerHTML = `
            <div class="swipe-delete-bg"><i class="fas fa-trash"></i></div>
            <div class="player-item${j.selecionado ? ' is-selected' : ''}">
                <input type="checkbox" class="player-check" ${j.selecionado ? 'checked' : ''}
                    onchange="toggleSelecionado(${j.id})">
                <div class="player-info">
                    <span class="tier-badge" title="${TIER_TITLE[j.tier]}">${TIER_DISPLAY[j.tier]}</span>
                    <strong>${j.nome}</strong>
                </div>
                <div class="player-item-actions">
                    <button onclick="abrirModal(${j.id})" class="btn-edit" title="Editar">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button onclick="removerJogador(${j.id})" class="btn-delete" title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;

        lista.appendChild(wrapper);
        iniciarSwipe(wrapper, j.id);
    });
}

// ─── SWIPE TO DELETE ─────────────────────────────────────────────────────────
function iniciarSwipe(wrapper, id) {
    const item      = wrapper.querySelector('.player-item');
    const THRESHOLD = 80; // px para confirmar delete
    let startX = 0, currentX = 0, dragging = false;

    const onStart = e => {
        startX   = (e.touches ? e.touches[0].clientX : e.clientX);
        currentX = 0;
        dragging = true;
        item.style.transition = 'none';
    };
    const onMove = e => {
        if (!dragging) return;
        const dx = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
        if (dx > 0) return; // só swipe para esquerda
        currentX = dx;
        item.style.transform = `translateX(${currentX}px)`;
        // previne scroll vertical durante swipe horizontal
        if (Math.abs(dx) > 10 && e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        item.style.transition = 'transform 0.25s ease';
        if (currentX < -THRESHOLD) {
            // anima saída e deleta
            item.style.transform = `translateX(-110%)`;
            wrapper.style.transition = 'max-height 0.3s ease, opacity 0.3s ease, margin 0.3s ease';
            wrapper.style.overflow = 'hidden';
            setTimeout(() => {
                wrapper.style.maxHeight = '0';
                wrapper.style.opacity   = '0';
                wrapper.style.marginBottom = '0';
            }, 50);
            setTimeout(() => removerJogador(id), 350);
        } else {
            item.style.transform = 'translateX(0)';
        }
        currentX = 0;
    };

    item.addEventListener('touchstart', onStart, { passive: true });
    item.addEventListener('touchmove',  onMove,  { passive: false });
    item.addEventListener('touchend',   onEnd);
}

// ─── ALGORITMO DE SORTEIO ────────────────────────────────────────────────────
/**
 * Anti-repetição: usa o histórico de duplas para penalizar
 * jogadores que ficaram juntos nas últimas rodadas.
 * Combina com embaralhamento agressivo dentro do tier.
 */
function chavedup(a, b) {
    return [a.id, b.id].sort().join('-');
}

function penalidade(time, jogador) {
    // Soma quantas vezes esse jogador já ficou com cada membro do time
    return time.jogadores.reduce((acc, membro) => {
        return acc + (historicoDuplas[chavedup(membro, jogador)] || 0);
    }, 0);
}

function algoritmoSorteio(presentes, qtdTimes) {
    // Embaralha fortemente dentro de cada tier
    const porTier = { A: [], B: [], C: [] };
    presentes.forEach(j => porTier[j.tier].push(j));
    Object.values(porTier).forEach(arr => {
        // Fisher-Yates
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    });

    // Fila: A → B → C (já embaralhado dentro de cada tier)
    const fila = [...porTier.A, ...porTier.B, ...porTier.C];

    const times = Array.from({ length: qtdTimes }, (_, i) => ({
        ...CORES_TIMES[i], jogadores: [], pontuacao: 0
    }));

    fila.forEach(jogador => {
        // Ordena times pelo custo combinado: tamanho + pontuação + penalidade de repetição
        times.sort((a, b) => {
            // 1. Equilíbrio em tamanho (peso alto)
            const diffTam = a.jogadores.length - b.jogadores.length;
            if (diffTam !== 0) return diffTam;

            // 2. Equilíbrio de pontuação
            const diffPts = a.pontuacao - b.pontuacao;

            // 3. Penalidade anti-repetição
            const penA = penalidade(a, jogador);
            const penB = penalidade(b, jogador);
            const diffPen = penA - penB;

            // Pontuação e penalidade têm pesos combinados
            return diffPts * 0.6 + diffPen * 10;
        });

        times[0].jogadores.push(jogador);
        times[0].pontuacao += PESOS[jogador.tier];
    });

    return times;
}

function registrarHistorico(times) {
    times.forEach(time => {
        const jogs = time.jogadores;
        for (let i = 0; i < jogs.length; i++) {
            for (let k = i + 1; k < jogs.length; k++) {
                const chave = chavedup(jogs[i], jogs[k]);
                historicoDuplas[chave] = (historicoDuplas[chave] || 0) + 1;
            }
        }
    });
    salvarHistorico();
}

// ─── SORTEIO PRINCIPAL ────────────────────────────────────────────────────────
function sortear() {
    const presentes = jogadores.filter(j => j.selecionado);
    const qtdTimes  = parseInt(document.getElementById('numTeams').value);

    if (presentes.length < qtdTimes * 2) {
        mostrarToast(`Selecione pelo menos ${qtdTimes * 2} jogadores para ${qtdTimes} times!`, 'error');
        return;
    }

    const btn = document.getElementById('btnSortear');
    btn.classList.add('loading');
    btn.querySelector('i').className = 'fas fa-spinner';

    setTimeout(() => {
        btn.classList.remove('loading');
        btn.querySelector('i').className = 'fas fa-shuffle';

        const times = algoritmoSorteio(presentes, qtdTimes);
        registrarHistorico(times);
        ultimosSorteados = { presentes, qtdTimes };
        mostrarResultado(times);
        dispararConfete();
    }, 450);
}

function ressortear() {
    if (!ultimosSorteados) return;
    const { presentes, qtdTimes } = ultimosSorteados;
    const times = algoritmoSorteio(presentes, qtdTimes);
    registrarHistorico(times);
    mostrarResultado(times);
    mostrarToast('Times re-sorteados! 🔀');
}

// ─── RESULTADO ───────────────────────────────────────────────────────────────
function mostrarResultado(times) {
    const container = document.getElementById('teams-container');
    container.innerHTML = times.map(time => `
        <div class="team-card">
            <div class="team-header">
                <h2>${time.nome}</h2>
                <span class="team-score">${time.jogadores.length} jogador${time.jogadores.length !== 1 ? 'es' : ''}</span>
            </div>
            <div class="team-list-content">
                ${time.jogadores.map((j, idx) => `
                    <div>${idx === 0 ? ' ' : ''}<span>${j.nome}</span></div>
                `).join('')}
            </div>
        </div>`).join('');

    document.getElementById('screen-manage').classList.add('hidden');
    document.getElementById('screen-result').classList.remove('hidden');
    container.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltar() {
    document.getElementById('screen-result').classList.add('hidden');
    document.getElementById('screen-manage').classList.remove('hidden');
}

// ─── COMPARTILHAR ────────────────────────────────────────────────────────────
function compartilhar() {
    const cards = document.querySelectorAll('.team-card');
    let texto = '🏐 *Vôlei da Galera — Times de hoje!*\n\n';
    cards.forEach(card => {
        const nome  = card.querySelector('h2').textContent;
        const jogEl = card.querySelectorAll('.team-list-content div');
        texto += `*${nome}*\n`;
        jogEl.forEach((el, i) => {
            texto += `${i === 0 ? '' : '•'} ${el.textContent.trim()}\n`;
        });
        texto += '\n';
    });

    if (navigator.share) {
        navigator.share({ title: 'Vôlei da Galera', text: texto }).catch(() => {});
    } else {
        navigator.clipboard.writeText(texto)
            .then(() => mostrarToast('Times copiados! Cole no WhatsApp 📋', 'success'))
            .catch(() => mostrarToast('Não foi possível copiar.', 'error'));
    }
}

// ─── BACKUP ──────────────────────────────────────────────────────────────────
function baixarBackup() {
    if (!jogadores.length) { mostrarToast('Nada para salvar!', 'error'); return; }
    const blob = new Blob([JSON.stringify(jogadores, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `backup_volei_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast('Backup salvo! 💾', 'success');
}

function restaurarBackup(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const json = JSON.parse(e.target.result);
            if (!Array.isArray(json)) { mostrarToast('Arquivo inválido.', 'error'); return; }
            mostrarConfirm(
                `Restaurar ${json.length} jogadores? A lista atual será substituída.`,
                () => { jogadores = json; salvarDados(); mostrarToast(`${json.length} jogadores restaurados! ✓`, 'success'); }
            );
        } catch { mostrarToast('Erro ao ler o arquivo JSON.', 'error'); }
        input.value = '';
    };
    reader.readAsText(file);
}

// ─── CONFETE ─────────────────────────────────────────────────────────────────
function dispararConfete() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#00d4aa','#1d4ed8','#dc2626','#f59e0b','#ffffff','#a78bfa'];
    const TOTAL  = 120;
    const particles = Array.from({ length: TOTAL }, () => ({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 200,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 5,
        r: Math.random() * Math.PI * 2,
        dr: (Math.random() - 0.5) * 0.2,
        vy: 2 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 1,
    }));

    let frame;
    const DURATION = 200; // frames (~3.3s a 60fps)
    let tick = 0;

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach(p => {
            if (p.y > canvas.height + 20) return;
            alive = true;
            p.y  += p.vy;
            p.x  += p.vx;
            p.r  += p.dr;
            p.vy += 0.05; // gravidade suave
            if (tick > DURATION * 0.6) p.opacity = Math.max(0, p.opacity - 0.015);

            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.r);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });

        tick++;
        if (alive && tick < DURATION + 60) {
            frame = requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    cancelAnimationFrame(frame);
    tick = 0;
    draw();
}