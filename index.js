// Importações dos módulos oficiais do Firebase via CDN (Sem precisar instalar nada)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    updateProfile,
    sendEmailVerification,   // NOVO: Para enviar link de ativação
    sendPasswordResetEmail, // NOVO: Para recuperar palavra-passe
    signOut                 // NOVO: Para desconectar contas não verificadas
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// NOVO: Importações do Cloud Firestore para guardar o perfil
import { 
    getFirestore, 
    doc, 
    setDoc, 
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
            console.error('Configuração do Firebase não encontrada ou inválida.');
            return;
        }

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (error) {
        console.error('Falha ao inicializar o Firebase:', error);
    }
})();
// Após inicializar o Firebase, aguarda e executa proteção de rota quando possível
(async () => {
    // espera até que a inicialização assíncrona defina `auth`
    for (let i = 0; i < 200; i++) {
        if (typeof auth !== 'undefined' && auth) break;
        await new Promise(r => setTimeout(r, 50));
    }

    // aguarda DOMContentLoaded caso ainda não tenha ocorrido
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    if (window.iniciarProtecaoRota) {
        try { window.iniciarProtecaoRota(); } catch (e) { console.warn('Falha ao iniciar proteção de rota:', e); }
    }
})();
const confirmPasswordField = document.getElementById('confirmPasswordField');
const authConfirmPasswordInput = document.getElementById('authConfirmPassword');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const verificationMessageContainer = document.getElementById('verificationMessageContainer');
const modalAlert = document.getElementById('modalAlert');
const authPasswordInput = document.getElementById('authPassword');
const passwordField = document.getElementById('passwordField');
const authEmailInput = document.getElementById('authEmail');
const registerNameInput = document.getElementById('registerName');

function displayAlert(message, type = 'error') {
    if (!modalAlert) return;
    modalAlert.textContent = message;
    modalAlert.className = `modal-alert ${type}`;
    modalAlert.style.display = 'block';
}

// Aguarda o HTML carregar completamente antes de rodar o script
document.addEventListener('DOMContentLoaded', () => {
    // MAPEAMENTO DOS ELEMENTOS DO DOM
    const authModal = document.getElementById('authModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');
    const nameField = document.getElementById('nameField');
    const authForm = document.getElementById('authForm');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authToggleLink = document.getElementById('authToggleLink');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    
    const navLoginBtn = document.getElementById('navLoginBtn');
    const navRegisterBtn = document.getElementById('navRegisterBtn');
    const heroStartBtn = document.getElementById('heroStartBtn');

    // Variável de controle do modo (login ou register)
    let currentMode = 'login'; 

    // PROTEÇÃO DE ROTA (Verifica se já está logado)
    window.iniciarProtecaoRota = function() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // REQUISITO 2: Só entra no dashboard se tiver o e-mail verificado
                if (user.emailVerified) {
                    window.location.href = "dashboard.html";
                } else {
                    // Se não verificou, força o logout preventivo na sessão ativa
                    signOut(auth);
                }
            }
        });
    }

    // FUNÇÃO PARA CONTROLAR A ABERTURA DO MODAL
    function openModal(mode) {
        currentMode = mode;
        if (authModal) authModal.classList.add('active');
        if (modalAlert) modalAlert.style.display = 'none';

        if (mode === 'login') {
            modalTitle.textContent = 'Entrar no Conexão';
            nameField.style.display = 'none';
            confirmPasswordField.style.display = 'none';
            forgotPasswordContainer.style.display = 'block';
            verificationMessageContainer.style.display = 'none';
            authSubmitBtn.textContent = 'Continuar';

            // Garante que o campo de senha aparece no login
            if (passwordField) passwordField.style.display = 'flex';
            authPasswordInput.required = true; 
        } 
        else if (mode === 'register') {
            modalTitle.textContent = 'Criar a tua Conta';
            nameField.style.display = 'flex';
            confirmPasswordField.style.display = 'flex';
            forgotPasswordContainer.style.display = 'none';
            verificationMessageContainer.style.display = 'none';
            authSubmitBtn.textContent = 'Cadastrar';

            // Garante que o campo de senha aparece no registo
            if (passwordField) passwordField.style.display = 'flex';
            authPasswordInput.required = true;
        }
        else if (mode === 'forgot-password') {
            modalTitle.textContent = 'Recuperar Conta';
            nameField.style.display = 'none';
            confirmPasswordField.style.display = 'none';
            forgotPasswordContainer.style.display = 'none';
            verificationMessageContainer.style.display = 'none';
            authSubmitBtn.textContent = 'Enviar Link de Redefinição';

            // ESCONDE o campo de senha completamente na recuperação
            if (passwordField) passwordField.style.display = 'none';
            authPasswordInput.required = false; 
        }
        else if (mode === 'verify-email') {
            modalTitle.textContent = 'Ative a sua Conta';
            nameField.style.display = 'none';
            confirmPasswordField.style.display = 'none';
            forgotPasswordContainer.style.display = 'none';
            verificationMessageContainer.style.display = 'block';
            authSubmitBtn.textContent = 'Reenviar E-mail';

            if (passwordField) passwordField.style.display = 'none';
            authPasswordInput.required = false;
        }
    }

    // FUNÇÃO PARA FECHAR O MODAL
    function closeModal() {
        if (authModal) {
            authModal.classList.remove('active');
        }
        if (authForm) authForm.reset(); // Limpa o formulário ao fechar
    }

    // ATRIBUIR EVENTOS AOS BOTÕES (Apenas se eles existirem na página)
    if (navLoginBtn) navLoginBtn.addEventListener('click', () => openModal('login'));
    if (navRegisterBtn) navRegisterBtn.addEventListener('click', () => openModal('register'));

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault(); // Impede a página de recarregar
            openModal('forgot-password'); // Abre o estado de recuperação
        });
    }

    if (heroStartBtn) {
        heroStartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('register');
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }

    // Fecha o modal se o utilizador clicar fora da caixa branca
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                closeModal();
            }
        });
    }

    // FUNÇÃO PARA REVINCULAR O CLIQUE DE ALTERNÂNCIA (LOGIN <-> CADASTRO)
    function rebindToggleLink() {
        const dynamicToggleLink = document.getElementById('authToggleLink');
        if (dynamicToggleLink) {
            dynamicToggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentMode === 'login') {
                    openModal('register');
                } else {
                    openModal('login');
                }
            });
        }
    }

    // ENVIO DO FORMULÁRIO (AUTENTICAÇÃO NO FIREBASE)
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = authEmailInput.value;
            const password = authPasswordInput.value;
            const name = registerNameInput ? registerNameInput.value : '';
            const confirmPassword = authConfirmPasswordInput ? authConfirmPasswordInput.value : '';

            try {
                // 1. MODO REGISTO (Cadastro)
                if (currentMode === 'register') {
                    // REQUISITO 1: Validar se as palavras-passe são idênticas
                    if (password !== confirmPassword) {
                        displayAlert('As palavras-passe introduzidas não coincidem.');
                        return;
                    }

                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;

                    await updateProfile(user, { displayName: name });

                    // REQUISITO 2: Disparar e-mail de verificação
                    await sendEmailVerification(user);

                    // REQUISITO 4: Guardar dados no Firestore
                    await setDoc(doc(db, "usuarios", user.uid), {
                        nome: name,
                        email: email,
                        dataCriacao: serverTimestamp() 
                    });

                    // Guardar temporariamente em cache para podermos fazer "Reenviar e-mail" se necessário
                    localStorage.setItem('lastUnverifiedEmail', email);
                    localStorage.setItem('lastUnverifiedPassword', password);

                    await signOut(auth); // Desconecta para impedir entrada forçada
                    displayAlert('Conta criada! Verifique a sua caixa de entrada para ativar.', 'success');
                    setTimeout(() => openModal('verify-email'), 2000);
                } 
                
                // 2. MODO LOGIN
                else if (currentMode === 'login') {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;

                    // REQUISITO 2: Impedir entrada se não validou o e-mail
                    if (!user.emailVerified) {
                        localStorage.setItem('lastUnverifiedEmail', email);
                        localStorage.setItem('lastUnverifiedPassword', password);
                        
                        await signOut(auth);
                        openModal('verify-email');
                        displayAlert('O seu e-mail ainda não foi verificado. Verifique a sua caixa de correio.');
                    }
                    // Se estiver tudo OK, o onAuthStateChanged trata do redirecionamento automático
                }

                // 3. MODO RECUPERAÇÃO DE SENHA
                else if (currentMode === 'forgot-password') {
                    // REQUISITO 3: Enviar e-mail de redefinição
                    await sendPasswordResetEmail(auth, email);
                    displayAlert('E-mail de redefinição enviado com sucesso!', 'success');
                    setTimeout(() => openModal('login'), 3000);
                }

                // 4. MODO REENVIO DE VERIFICAÇÃO
                else if (currentMode === 'verify-email') {
                    const cachedEmail = localStorage.getItem('lastUnverifiedEmail');
                    const cachedPassword = localStorage.getItem('lastUnverifiedPassword');

                    if (cachedEmail && cachedPassword) {
                        // Autentica em background rapidamente para reenviar o token
                        const tempUser = await signInWithEmailAndPassword(auth, cachedEmail, cachedPassword);
                        await sendEmailVerification(tempUser.user);
                        await signOut(auth);
                        displayAlert('Novo link de ativação enviado!', 'success');
                    } else {
                        displayAlert('Por segurança, faça login novamente para reenviar.');
                        setTimeout(() => openModal('login'), 2000);
                    }
                }

            } catch (error) {
                console.error("Erro detectado:", error.code);
                
                // Se o botão de envio foi desativado, reativa-o aqui
                if (authSubmitBtn) {
                    authSubmitBtn.disabled = false;
                    authSubmitBtn.textContent = currentMode === 'login' ? 'Continuar' : 'Cadastrar';
                }

                // CAPTURA DO ERRO DE E-MAIL EM USO:
                if (error.code === 'auth/email-already-in-use') {
                    displayAlert('Este e-mail já está em uso por outra conta. Tente fazer login.');
                } 
                else if (error.code === 'auth/weak-password') {
                    displayAlert('A palavra-passe é demasiado fraca. Use pelo menos 6 caracteres.');
                } 
                else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                    displayAlert('E-mail ou palavra-passe incorretos.');
                } 
                else if (error.code === 'auth/user-not-found') {
                    displayAlert('Nenhuma conta encontrada com este e-mail.');
                } 
                else {
                    // Mensagem padrão caso seja outro erro inesperado
                    displayAlert('Ocorreu um erro: ' + error.message);
                }
            }
        });
    }
});