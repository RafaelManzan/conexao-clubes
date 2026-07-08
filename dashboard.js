import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

// 1. IMPORTAÇÕES DA AUTENTICAÇÃO (firebase-auth.js)
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    updateEmail,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. IMPORTAÇÕES DA BASE DE DADOS (firebase-firestore.js)
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs,
    getDoc, 
    setDoc,
    query, 
    where, 
    updateDoc,
    arrayRemove,
    addDoc,
    arrayUnion,
    orderBy,       
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Carregar configuração do Firebase do ambiente
import { carregarAmbiente } from './env-loader.js';

let app, auth, db;

// Inicializar Firebase com configuração do ambiente
(async () => {
    try {
        const env = await carregarAmbiente();
        const firebaseConfig = env?.FIREBASE_CONFIG_JSON;

        if (!firebaseConfig || typeof firebaseConfig !== 'object') {
            console.error('Configuração do Firebase não encontrada ou inválida no dashboard.');
            return;
        }

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        // Após inicializar o Firebase, inicia os observadores de sessão
        try { iniciarControleSessao(); } catch (e) { console.warn('Falha ao iniciar controle de sessão:', e); }
    } catch (error) {
        console.error('Falha ao inicializar o Firebase no dashboard:', error);
    }
})();

// Captura de Elementos com Verificação de Segurança
const userNameDisplay = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('profileLogoutBtn');
const currentAvatarBox = document.getElementById('currentAvatarBox');
const currentAvatarImg = document.getElementById('currentAvatarImg');
const avatarOptions = document.querySelectorAll('.avatar-option');

let usuarioAtual = null;

/* ==========================================================================
   1. CONTROLE DE SESSÃO
   ========================================================================== */
function iniciarControleSessao() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Utilizador autenticado com o UID:", user.uid);
            usuarioAtual = user;

            const nameDisplay = document.getElementById('userName') || document.getElementById('userNameDisplay');
            const emailDisplay = document.getElementById('userEmail') || document.getElementById('userEmailDisplay');

            if (nameDisplay) nameDisplay.textContent = user.displayName || "Estudante";
            if (emailDisplay) emailDisplay.textContent = user.email || "";

            carregarAvatarAtual(user.uid);
            carregarMeusClubes(user.uid);
            inicializarAbaSugestoes(user.uid);
            inicializarRedeSocial(user);

        } else {
            window.location.href = "index.html";
        }
    });
}
/* ==========================================================================
   2. GESTÃO DOS AVATARES (SETDOC + MERGE)
   ========================================================================== */
async function carregarAvatarAtual(uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists() && userDocSnap.data().avatar) {
            const avatarSalvo = userDocSnap.data().avatar;
            marcarAvatarAtivo(avatarSalvo);
            
            if (currentAvatarImg && currentAvatarBox) {
                currentAvatarImg.src = `assets/${avatarSalvo}`;
                currentAvatarBox.style.display = 'flex';
            }
        } else {
            ocultarVisualizacaoAvatar();
        }
    } catch (error) {
        console.error("Erro ao carregar avatar:", error);
        ocultarVisualizacaoAvatar();
    }
}

function ocultarVisualizacaoAvatar() {
    if (currentAvatarBox) currentAvatarBox.style.display = 'none';
    if (currentAvatarImg) currentAvatarImg.src = "";
    if (avatarOptions) avatarOptions.forEach(opt => opt.classList.remove('active'));
}

function marcarAvatarAtivo(nomeAvatar) {
    if (avatarOptions) {
        avatarOptions.forEach(opt => {
            if (opt.getAttribute('data-avatar') === nomeAvatar) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }
}

if (avatarOptions && avatarOptions.length > 0) {
    avatarOptions.forEach(avatar => {
        avatar.addEventListener('click', async () => {
            if (!usuarioAtual) return;
            const nomeAvatar = avatar.getAttribute('data-avatar');
            
            try {
                // setDoc cria o documento caso o utilizador ainda não o tenha no Firestore
                await setDoc(doc(db, "usuarios", usuarioAtual.uid), {
                    avatar: nomeAvatar
                }, { merge: true });
                
                marcarAvatarAtivo(nomeAvatar);
                if (currentAvatarImg && currentAvatarBox) {
                    currentAvatarImg.src = `assets/${nomeAvatar}`;
                    currentAvatarBox.style.display = 'flex';
                }
                alert("Avatar guardado com sucesso!");
            } catch (error) {
                alert("Erro ao salvar o avatar: " + error.message);
            }
        });
    });
}

/* ==========================================================================
   ETAPA 3: GESTÃO DE CLUBES E LOGICA DE PERMISSÕES
   ========================================================================== */

// 1. Chame esta função dentro do seu onAuthStateChanged quando o utilizador estiver logado:
// Exemplo: no onAuthStateChanged, logo abaixo de carregarAvatarAtual(user.uid); coloque: carregarMeusClubes(user.uid);

async function carregarMeusClubes(uid) {
    const container = document.getElementById('meus-clubes');
    if (!container) return;

    // Criamos a estrutura base de troca de telas se ela não existir
    container.innerHTML = `
        <div id="grid-clubes-view">
            <h3 style="margin-bottom:1.5rem;">Os Meus Clubes</h3>
            <div class="clubes-grid" id="clubesGrid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem;">
                <p>A carregar clubes...</p>
            </div>
        </div>
        <div id="detalhe-clube-view" style="display:none;">
            </div>
    `;

    const gridCont = document.getElementById('clubesGrid');

    try {
        // Procurar clubes onde o utilizador é Admin OU é Membro
        const qAdmin = query(collection(db, "clubes"), where("adminId", "==", uid));
        const qMembro = query(collection(db, "clubes"), where("membros", "array-contains", uid));

        const [snapAdmin, snapMembro] = await Promise.all([getDocs(qAdmin), getDocs(qMembro)]);
        
        let clubesIds = new Set();
        let listaClubes = [];

        // Adiciona os que ele administra
        snapAdmin.forEach(doc => {
            if(!clubesIds.has(doc.id)) {
                clubesIds.add(doc.id);
                listaClubes.push({ id: doc.id, ...doc.data(), isAdmin: true });
            }
        });

        // Adiciona os que ele é membro comum
        snapMembro.forEach(doc => {
            if(!clubesIds.has(doc.id)) {
                clubesIds.add(doc.id);
                listaClubes.push({ id: doc.id, ...doc.data(), isAdmin: false });
            }
        });

        if (listaClubes.length === 0) {
            gridCont.innerHTML = "<p class='text-muted'>Ainda não estás associado a nenhum clube.</p>";
            return;
        }

        gridCont.innerHTML = ""; // Limpa o carregando

        listaClubes.forEach(clube => {
            const card = document.createElement('div');
            card.className = "profile-card"; // Reutilizando os estilos de cartões modernos do style.css
            card.style.cursor = "pointer";
            card.style.padding = "0";
            card.style.overflow = "hidden";
            card.style.display = "flex";
            card.style.flexDirection = "column";

            const tagSelo = clube.isAdmin 
                ? `<span style="background:var(--primary); color:#fff; padding:0.25rem 0.6rem; border-radius:20px; font-size:0.75rem; font-weight:600;">Administrador</span>`
                : `<span style="background:var(--success); color:#fff; padding:0.25rem 0.6rem; border-radius:20px; font-size:0.75rem; font-weight:600;">Membro</span>`;

            card.innerHTML = `
                <div style="height:120px; background: url('${clube.bannerUrl || 'img/default-banner.jpg'}') center/cover no-repeat; width:100%;"></div>
                <div style="padding:1.25rem; flex-grow:1; display:flex; flex-direction:column; gap:0.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small class="text-muted" style="text-transform:uppercase; font-weight:600; font-size:0.75rem;">${clube.categoria}</small>
                        ${tagSelo}
                    </div>
                    <h4 style="margin:0; font-family:var(--font-title);">${clube.nome}</h4>
                    <p class="text-muted" style="font-size:0.85rem; margin:0; margin-top:auto;">Resp: ${clube.responsavel}</p>
                </div>
            `;

            // Evento para abrir a página interna do clube
            card.addEventListener('click', () => abrirDetalhesClube(clube, uid));
            gridCont.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar clubes:", error);
        gridCont.innerHTML = "<p>Erro ao carregar os teus clubes.</p>";
    }
}

// 2. Página Interna Dinâmica com Verificação de Permissões
function abrirDetalhesClube(clube, uid) {
    const gridView = document.getElementById('grid-clubes-view');
    const detalheView = document.getElementById('detalhe-clube-view');
    
    if(!gridView || !detalheView) return;

    gridView.style.display = 'none';
    detalheView.style.display = 'block';

    detalheView.innerHTML = `
        <button class="btn btn-secondary" id="btnVoltarGrid" style="margin-bottom:1.5rem; padding:0.5rem 1rem;">< Voltar aos Clubes</button>
        
        <div style="height:220px; background: url('${clube.bannerUrl || 'img/default-banner.jpg'}') center/cover no-repeat; border-radius:var(--radius); position:relative; margin-bottom:1.5rem; display:flex; align-items:flex-end; padding:1.5rem;">
            <div style="position:absolute; top:0; left:0; right:0; bottom:0; background:linear-gradient(to top, rgba(0,0,0,0.7), transparent); border-radius:var(--radius);"></div>
            <div style="position:relative; color:#fff; z-index:1;">
                <span style="background:var(--secondary); font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:20px; font-weight:600; text-transform:uppercase;">${clube.categoria}</span>
                <h2 style="font-family:var(--font-title); margin-top:0.5rem; margin-bottom:0.25rem; font-size:2rem;">${clube.nome}</h2>
                <p style="margin:0; opacity:0.9; font-size:0.9rem;">Responsável: ${clube.responsavel}</p>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; align-items: start;">
            <div class="profile-card">
                <h4 style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
                    Mural de Avisos
                    ${clube.isAdmin ? `<button class="btn btn-primary" id="btnEditarMural" style="padding:0.25rem 0.5rem; font-size:0.8rem;">Editar</button>` : ''}
                </h4>
                <p id="txtMural" style="white-space:pre-wrap; line-height:1.6;">${clube.mural || 'Nenhum aviso de momento.'}</p>
            </div>

            <div class="profile-card">
                <h4 style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
                    Agenda e Horários
                    ${clube.isAdmin ? `<button class="btn btn-primary" id="btnEditarAgenda" style="padding:0.25rem 0.5rem; font-size:0.8rem;">Editar</button>` : ''}
                </h4>
                <p id="txtAgenda" style="white-space:pre-wrap; line-height:1.6;">${clube.agenda || 'Nenhum horário agendado.'}</p>
            </div>
        </div>

        ${clube.isAdmin ? `
            <div class="profile-card" style="margin-top:1.5rem;">
                <h4>Painel do Administrador: Alterar Imagem de Banner</h4>
                <div class="form-group" style="margin-top:1rem; display:flex; gap:1rem; align-items:center;">
                    <input type="url" id="inputBannerUrl" placeholder="Cole aqui o link da nova imagem (URL)..." style="flex-grow:1;">
                    <button id="btnAtualizarBanner" class="btn btn-primary">Salvar Banner</button>
                </div>
            </div>
        ` : `
            <div style="margin-top:2rem; text-align:center;">
                <button id="btnSairClube" class="btn btn-danger" style="padding:0.75rem 2rem;">Sair deste Clube</button>
            </div>
        `}
    `;

    // Ação do Botão Voltar
    document.getElementById('btnVoltarGrid').addEventListener('click', () => {
        detalheView.style.display = 'none';
        gridView.style.display = 'block';
        carregarMeusClubes(uid); // Recarrega para trazer dados atualizados
    });

    // Lógica Exclusiva de Admin
    if (clube.isAdmin) {
        // Editar Mural
        document.getElementById('btnEditarMural').addEventListener('click', async () => {
            const novoTexto = prompt("Edite o Mural de Avisos:", clube.mural || "");
            if (novoTexto !== null) {
                try {
                    await updateDoc(doc(db, "clubes", clube.id), { mural: novoTexto });
                    document.getElementById('txtMural').textContent = novoTexto || 'Nenhum aviso de momento.';
                    clube.mural = novoTexto;
                } catch (e) { alert("Erro ao atualizar mural: " + e.message); }
            }
        });

        // Editar Agenda
        document.getElementById('btnEditarAgenda').addEventListener('click', async () => {
            const novoTexto = prompt("Edite a Agenda do Clube:", clube.agenda || "");
            if (novoTexto !== null) {
                try {
                    await updateDoc(doc(db, "clubes", clube.id), { agenda: novoTexto });
                    document.getElementById('txtAgenda').textContent = novoTexto || 'Nenhum horário agendado.';
                    clube.agenda = novoTexto;
                } catch (e) { alert("Erro ao atualizar agenda: " + e.message); }
            }
        });

        // Alterar URL do Banner
        document.getElementById('btnAtualizarBanner').addEventListener('click', async () => {
            const urlInput = document.getElementById('inputBannerUrl').value.trim();
            if(!urlInput) return alert("Por favor, introduza uma URL válida.");
            try {
                await updateDoc(doc(db, "clubes", clube.id), { bannerUrl: urlInput });
                alert("Banner atualizado com sucesso! Volte para aplicar a alteração visual.");
            } catch (e) { alert("Erro ao salvar banner: " + e.message); }
        });

    } else {
        // Lógica de Membro: Sair do Clube
        document.getElementById('btnSairClube').addEventListener('click', async () => {
            if (confirm(`Tens a certeza que desejas sair do clube "${clube.nome}"?`)) {
                try {
                    await updateDoc(doc(db, "clubes", clube.id), {
                        membros: arrayRemove(uid)
                    });
                    alert("Te desvinculaste do clube com sucesso.");
                    // Retorna para a listagem limpa
                    detalheView.style.display = 'none';
                    gridView.style.display = 'block';
                    carregarMeusClubes(uid);
                } catch (e) { alert("Erro ao sair do clube: " + e.message); }
            }
        });
    }
}

/* ==========================================================================
   ETAPA 4: ABA DE SUGESTÕES E LÓGICA DE VOTO ÚNICO
   ========================================================================== */

function inicializarAbaSugestoes(uid) {
    const btnAbrir = document.getElementById('btnAbrirModalSugestao');
    const btnFechar = document.getElementById('btnFecharModalSugestao');
    const modal = document.getElementById('modalSugestao');
    const form = document.getElementById('formSugestao');

    if (!modal) return; // Proteção defensiva

    // 1. Controlo de Abertura/Fecho do Modal
    if (btnAbrir) {
        btnAbrir.addEventListener('click', () => modal.style.display = 'flex');
    }
    if (btnFechar) {
        btnFechar.addEventListener('click', () => {
            modal.style.display = 'none';
            form.reset();
        });
    }

    // 2. Submissão do Formulário de Sugestões
    if (form) {
        // Remove ouvintes antigos para evitar duplicações ao trocar de abas
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('sugestaoNome').value.trim();
            const categoria = document.getElementById('sugestaoCategoria').value.trim();
            const descricao = document.getElementById('sugestaoDescricao').value.trim();

            try {
                // Guarda no Firestore com array de votos vazio
                await addDoc(collection(db, "sugestoes"), {
                    nome: nome,
                    categoria: categoria,
                    descricao: descricao,
                    criadorId: uid,
                    votos: [] // Array inicializado vazio (0 votos)
                });

                alert("Sugestão enviada com sucesso! Divulga a tua ideia para receberes votos.");
                modal.style.display = 'none';
                form.reset();
                
                // Recarrega a lista imediatamente
                carregarCartoesSugestoes(uid);
            } catch (error) {
                console.error("Erro ao guardar sugestão:", error);
                alert("Erro ao submeter a tua sugestão. Tenta novamente.");
            }
        };
    }

    // 3. Executa o carregamento inicial dos cartões
    carregarCartoesSugestoes(uid);
}

// 4. Renderização Dinâmica dos Cartões e Regra Antifraude
async function carregarCartoesSugestoes(uid) {
    const container = document.getElementById('container-sugestoes');
    if (!container) return;

    try {
        const querySnapshot = await getDocs(collection(db, "sugestoes"));
        container.innerHTML = ""; // Limpa o estado de carregamento

        if (querySnapshot.empty) {
            container.innerHTML = "<p class='text-muted'>Ainda não há nenhuma sugestão enviada. Seja o primeiro!</p>";
            return;
        }

        querySnapshot.forEach((documento) => {
            const data = documento.data();
            const docId = documento.id;
            
            const listaVotos = data.votos || [];
            const totalVotos = listaVotos.length;
            const jaVotou = listaVotos.includes(uid); // Verifica se o UID do aluno está no array

            const card = document.createElement('div');
            card.className = "profile-card";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.justifyContent = "between";
            card.style.position = "relative";
            card.style.gap = "0.75rem";

            // Regra do Selo Promovido (15 ou mais votos)
            let seloDestaque = "";
            if (totalVotos >= 15) {
                seloDestaque = `
                    <div style="background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: bold; align-self: flex-start; margin-bottom: 0.25rem; box-shadow: 0 2px 4px rgba(239,68,68,0.3);">
                        🔥 Em análise pela Direção
                    </div>
                `;
                card.style.border = "1px solid #f59e0b"; // Borda dourada de destaque
            }

            // Configuração visual do botão (Mudança para cinzento se já votou)
            const textoBotao = jaVotou ? "✓ Votado" : "👍 Votar";
            const corBotao = jaVotou ? "background: #9ca3af; color: #fff;" : "background: var(--primary); color: #fff;";

            card.innerHTML = `
                ${seloDestaque}
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <small class="text-muted" style="text-transform: uppercase; font-weight: 600; font-size: 0.7rem;">${data.categoria}</small>
                    <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main); background: rgba(0,0,0,0.05); padding: 0.2rem 0.6rem; border-radius: 6px;">
                        ${totalVotos} ${totalVotos === 1 ? 'voto' : 'votos'}
                    </span>
                </div>
                <h4 style="margin: 0; font-family: var(--font-title); font-size: 1.2rem;">${data.nome}</h4>
                <p class="text-muted" style="font-size: 0.85rem; line-height: 1.5; flex-grow: 1;">${data.descricao}</p>
                
                <button class="btn btn-voto" data-id="${docId}" data-votado="${jaVotou}" style="width: 100%; padding: 0.5rem; border-radius: 8px; font-weight: 600; ${corBotao} transition: var(--transition);">
                    ${textoBotao}
                </button>
            `;

            // 5. Aplicação da Regra Antifraude via Toggle no clique do botão
            const btnVoto = card.querySelector('.btn-voto');
            btnVoto.addEventListener('click', async () => {
                btnVoto.disabled = true; // Bloqueia cliques duplos rápidos
                const docRef = doc(db, "sugestoes", docId);

                try {
                    if (jaVotou) {
                        // Se já votou, remove o UID do array (retira o voto)
                        await updateDoc(docRef, {
                            votos: arrayRemove(uid)
                        });
                    } else {
                        // Se não votou, adiciona o UID ao array (computa o voto único)
                        await updateDoc(docRef, {
                            votos: arrayUnion(uid)
                        });
                    }
                    
                    // Atualiza a lista em tempo real na tela após mutação
                    carregarCartoesSugestoes(uid);
                } catch (err) {
                    console.error("Erro ao processar voto:", err);
                    btnVoto.disabled = false;
                }
            });

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar sugestões:", error);
        container.innerHTML = "<p>Erro ao ler as sugestões do servidor.</p>";
    }
}

/* ==========================================================================
   ETAPA 5: REDE SOCIAL INTERNA (VERSÃO INTEGRADA COM TEU AVATAR DO FIREBASE)
   ========================================================================== */

function inicializarRedeSocial(user) {
    const form = document.getElementById('formCriarPost');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();

        const texto = document.getElementById('postTexto').value.trim();
        const imagemUrl = document.getElementById('postImagemUrl').value.trim();

        // 💡 CAPTURA DINÂMICA: Pega o URL real do teu avatar que já está carregado no ecrã!
        const avatarDoEcra = document.getElementById('currentAvatarImg')?.src || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

        try {
            await addDoc(collection(db, "posts"), {
                texto: texto,
                imagemUrl: imagemUrl || null,
                uid: user.uid,
                nomeUsuario: user.displayName || "Estudante",
                avatarUsuario: avatarDoEcra, // 👈 Grava o URL exato do teu Firebase Storage/Firestore
                timestamp: serverTimestamp(),
                likes: []
            });

            form.reset();
            carregarFeedPosts(user.uid);
        } catch (error) {
            console.error("Erro ao publicar post:", error);
            alert("Não foi possível publicar. Tenta novamente.");
        }
    };

    carregarFeedPosts(user.uid);
}

async function carregarFeedPosts(currentUid) {
    const feedContainer = document.getElementById('feed-container');
    if (!feedContainer) return;

    try {
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        
        feedContainer.innerHTML = "";

        if (querySnapshot.empty) {
            feedContainer.innerHTML = "<p class='text-muted' style='text-align:center;'>O feed está vazio. Partilha a primeira novidade!</p>";
            return;
        }

        querySnapshot.forEach(async (documento) => {
            const post = documento.data();
            const postId = documento.id;

            const listaLikes = post.likes || [];
            const totalLikes = listaLikes.length;
            const jaDeuLike = listaLikes.includes(currentUid);

            // 🛡️ PROTEÇÃO ANTIFRAUDE DE 404: Se o post antigo tiver o link quebrado, limpa-o em tempo de execução
            let avatarFinal = post.avatarUsuario || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            if (avatarFinal.includes("avatar-default.png")) {
                avatarFinal = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            }

            let dataFormatada = "Recentemente";
            if (post.timestamp) {
                const d = post.timestamp.toDate();
                dataFormatada = d.toLocaleDateString('pt-PT') + " às " + d.toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'});
            }

            const postCard = document.createElement('div');
            postCard.className = "profile-card";
            postCard.style.padding = "1.5rem";
            postCard.style.display = "flex";
            postCard.style.flexDirection = "column";
            postCard.style.gap = "1rem";

            const tagImagem = post.imagemUrl ? `
                <div style="width: 100%; margin-top: 0.5rem; border-radius: 8px; overflow: hidden;">
                    <img src="${post.imagemUrl}" alt="Imagem do post" style="width: 100%; height: auto; display: block;">
                </div>
            ` : "";

            const corCoracao = jaDeuLike ? "color: #ef4444;" : "color: #9ca3af;";
            const iconeCoracao = jaDeuLike ? "❤️" : "🤍";

            postCard.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <img src="${avatarFinal}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
                    <div>
                        <h4 style="margin: 0; font-size: 0.95rem; font-family: var(--font-title);">${post.nomeUsuario}</h4>
                        <small class="text-muted" style="font-size: 0.75rem;">${dataFormatada}</small>
                    </div>
                </div>

                <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: var(--text-main); white-space: pre-wrap;">${post.texto}</p>
                ${tagImagem}

                <div style="display: flex; gap: 1.5rem; border-top: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.05); padding: 0.5rem 0; margin-top: 0.5rem;">
                    <button class="btn-like" data-id="${postId}" style="background: none; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; ${corCoracao}">
                        <span>${iconeCoracao}</span> <span class="likes-count">${totalLikes}</span> Gostos
                    </button>
                    <button class="btn-toggle-comentarios" style="background: none; border: none; cursor: pointer; color: var(--primary); font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.4rem;">
                        💬 Comentários
                    </button>
                </div>

                <div class="seccao-comentarios" style="display: none; flex-direction: column; gap: 0.75rem; background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 8px;">
                    <div class="lista-comentarios" style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 200px; overflow-y: auto;">
                        <small class="text-muted">A carregar comentários...</small>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <input type="text" class="input-comentario" placeholder="Escreve um comentário..." style="flex: 1; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid rgba(0,0,0,0.1); font-size: 0.85rem;">
                        <button class="btn-enviar-comentario" style="background: var(--primary); color: white; border: none; border-radius: 6px; padding: 0.4rem 0.8rem; font-size: 0.85rem; cursor: pointer; font-weight: 600;">Enviar</button>
                    </div>
                </div>
            `;

            // Lógica do Like
            const btnLike = postCard.querySelector('.btn-like');
            btnLike.onclick = async () => {
                btnLike.disabled = true;
                const docRef = doc(db, "posts", postId);
                try {
                    if (jaDeuLike) {
                        await updateDoc(docRef, { likes: arrayRemove(currentUid) });
                    } else {
                        await updateDoc(docRef, { likes: arrayUnion(currentUid) });
                    }
                    carregarFeedPosts(currentUid);
                } catch (err) {
                    console.error("Erro no Like:", err);
                    btnLike.disabled = false;
                }
            };

            // Lógica de Comentários
            const btnToggleComentarios = postCard.querySelector('.btn-toggle-comentarios');
            const blocoComentarios = postCard.querySelector('.seccao-comentarios');
            const listaComentarios = postCard.querySelector('.lista-comentarios');
            const inputComentario = postCard.querySelector('.input-comentario');
            const btnEnviarComentario = postCard.querySelector('.btn-enviar-comentario');

            btnToggleComentarios.onclick = () => {
                if (blocoComentarios.style.display === "none") {
                    blocoComentarios.style.display = "flex";
                    atualizarListaComentarios(postId, listaComentarios);
                } else {
                    blocoComentarios.style.display = "none";
                }
            };

            btnEnviarComentario.onclick = async () => {
                const textoComentario = inputComentario.value.trim();
                if (!textoComentario) return;

                btnEnviarComentario.disabled = true;
                
                // 💡 CAPTURA DINÂMICA: Pega o teu avatar real para colocar também no comentário
                const avatarComentarioEcra = document.getElementById('currentAvatarImg')?.src || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

                try {
                    await addDoc(collection(db, "posts", postId, "comentarios"), {
                        texto: textoComentario,
                        nomeAutor: auth.currentUser.displayName || "Estudante",
                        avatarAutor: avatarComentarioEcra, // 👈 Aqui
                        timestamp: serverTimestamp()
                    });

                    inputComentario.value = "";
                    atualizarListaComentarios(postId, listaComentarios);
                } catch (err) {
                    console.error("Erro ao enviar comentário:", err);
                } finally {
                    btnEnviarComentario.disabled = false;
                }
            };

            feedContainer.appendChild(postCard);
        });

    } catch (error) {
        console.error("Erro ao ler o feed:", error);
        feedContainer.innerHTML = "<p>Erro de comunicação com a base de dados do feed.</p>";
    }
}

async function atualizarListaComentarios(postId, containerLista) {
    try {
        const qComents = query(collection(db, "posts", postId, "comentarios"), orderBy("timestamp", "asc"));
        const snapshot = await getDocs(qComents);
        
        containerLista.innerHTML = "";

        if (snapshot.empty) {
            containerLista.innerHTML = "<small class='text-muted' style='font-style:italic;'>Ainda não há comentários nesta publicação.</small>";
            return;
        }

        snapshot.forEach((docCom) => {
            const com = docCom.data();
            const item = document.createElement('div');
            item.style.display = "flex";
            item.style.gap = "0.5rem";
            item.style.alignItems = "flex-start";
            item.style.fontSize = "0.85rem";
            item.style.background = "#fff";
            item.style.padding = "0.5rem";
            item.style.borderRadius = "6px";
            item.style.boxShadow = "0 1px 2px rgba(0,0,0,0.02)";

            // 🛡️ Filtro antifraude para avatares antigos nos comentários
            let avatarComentFinal = com.avatarAutor || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            if (avatarComentFinal.includes("avatar-default.png")) {
                avatarComentFinal = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            }

            item.innerHTML = `
                <img src="${avatarComentFinal}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                <div style="flex: 1;">
                    <strong style="color: var(--text-main); font-weight:600;">${com.nomeAutor}</strong>
                    <p style="margin: 2px 0 0 0; color: var(--text-muted); line-height:1.3;">${com.texto}</p>
                </div>
            `;
            containerLista.appendChild(item);
        });
        
        containerLista.scrollTop = containerLista.scrollHeight;

    } catch (err) {
        console.error("Erro ao buscar comentários:", err);
        containerLista.innerHTML = "<small class='text-muted'>Erro ao processar comentários.</small>";
    }
}

/* ==========================================================================
   6. FUNÇÃO AUXILIAR: REAUTENTICAÇÃO
   ========================================================================== */
async function reautenticar(senhaAtual) {
    if (!usuarioAtual || !usuarioAtual.email) {
        throw new Error("Nenhum utilizador encontrado para reautenticação.");
    }
    const credencial = EmailAuthProvider.credential(usuarioAtual.email, senhaAtual);
    return reauthenticateWithCredential(usuarioAtual, credencial);
}

/* ==========================================================================
   7. ALTERAR PALAVRA-PASSE
   ========================================================================== */
const passwordChangeForm = document.getElementById('passwordChangeForm');
if (passwordChangeForm) {
    passwordChangeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const senhaAtual = document.getElementById('currentPassword').value;
        const novaSenha = document.getElementById('newPassword').value;

        if (novaSenha.length < 6) {
            alert("A nova palavra-passe deve ter pelo menos 6 caracteres.");
            return;
        }

        try {
            await reautenticar(senhaAtual);
            await updatePassword(usuarioAtual, novaSenha);
            alert("Palavra-passe atualizada com sucesso!");
            passwordChangeForm.reset();
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                alert("A palavra-passe atual inserida está incorreta.");
            } else {
                alert("Erro ao atualizar a palavra-passe: " + error.message);
            }
        }
    });
}

/* ==========================================================================
   8. ALTERAR E-MAIL ACADÉMICO
   ========================================================================== */
const emailChangeForm = document.getElementById('emailChangeForm');
if (emailChangeForm) {
    emailChangeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const senhaAtual = document.getElementById('emailAuthPassword').value;
        const novoEmail = document.getElementById('newEmail').value;

        try {
            await reautenticar(senhaAtual);
            await updateEmail(usuarioAtual, novoEmail);
            
            // Alinhado para setDoc com merge para evitar falhas de documento ausente
            await setDoc(doc(db, "usuarios", usuarioAtual.uid), {
                email: novoEmail
            }, { merge: true });
            
            await sendEmailVerification(usuarioAtual);
            alert("E-mail atualizado! Validando segurança, a sessão será encerrada.");
            
            await signOut(auth);
            window.location.href = "index.html";
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                alert("A palavra-passe de confirmação está incorreta.");
            } else if (error.code === 'auth/email-already-in-use') {
                alert("Este e-mail já está associado a outra conta.");
            } else {
                alert("Erro ao atualizar o e-mail: " + error.message);
            }
        }
    });
}

/* ==========================================================================
   9. CONTROLE DE ABAS (TABS)
   ========================================================================== */
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

if (tabButtons && tabContents.length > 0) {
    // Inicialização: Garante que apenas a aba ativa configurada no HTML apareça no carregamento
    const activeBtn = document.querySelector('.tab-btn.active');
    const initialTabId = activeBtn ? activeBtn.getAttribute('data-tab') : 'meus-clubes';
    
    tabContents.forEach(content => {
        if (content.id === initialTabId) {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    });

    // Ouvinte de clique para alternar as abas
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');

            button.classList.add('active');
            const targetElement = document.getElementById(targetTab);
            if (targetElement) targetElement.style.display = 'block'; 
        });
    });
}

/* ==========================================================================
   10. LOGOUT (SAIR DA CONTA)
   ========================================================================== */
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        }).catch((error) => {
            alert("Erro ao tentar sair: " + error.message);
        });
    });
}