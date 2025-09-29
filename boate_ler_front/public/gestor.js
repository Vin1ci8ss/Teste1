// Apenas uma das URLs abaixo deve estar descomentada por vez.
// Use a URL da DigitalOcean para a versão online
//const API_BASE_URL = 'https://king-prawn-app-6jvyu.ondigitalocean.app';

// Se estiver rodando localmente, descomente a linha abaixo e comente a de cima
// const API_BASE_URL = "http://localhost:8080";

// Se estiver rodando localmente com um IP específico, descomente a linha abaixo
// const API_BASE_URL = 'http://192.168.0.49:8080'

// Verifica se a URL termina com "/api" e a remove
const BACKEND_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;

// Elementos de tela
const app = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const tecbinsOptionsScreen = document.getElementById('tecbins-options-screen');
const setupOptionsScreen = document.getElementById('setup-options-screen');
const cadastroSalaScreen = document.getElementById('cadastro-sala-screen');
const cadastroOperadorScreen = document.getElementById('cadastro-operador-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
// REMOVIDO: const mainContentScreen = document.getElementById('main-content-screen');

// Elementos de formulário e botões
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const acessarConsultaBtn = document.getElementById('acessar-consulta-btn');
const agendarAtendimentoBtn = document.getElementById('agendar-atendimento-btn');
const setupBtn = document.getElementById('setup-btn');
const logoutBtn = document.getElementById('logout-btn');
const logoutFromSetupBtn = document.getElementById('logout-from-setup-btn');
const logoutFromTecbinsOptionsBtn = document.getElementById('logout-from-tecbins-options-btn');
const cadastrarSalaBtn = document.getElementById('cadastrar-sala-btn');
const cadastroOperadorBtn = document.getElementById('cadastro-operador-btn');
const voltarBtn = document.getElementById('voltar-btn');
const voltarSetupSalaBtn = document.getElementById('voltar-setup-sala-btn');
const voltarSetupOperadorBtn = document.getElementById('voltar-setup-operador-btn');
const cadastroSalaForm = document.getElementById('cadastro-sala-form');
const nomeSalaInput = document.getElementById('nome-sala');
const idSalaInput = document.getElementById('id-sala');
const listaSalasContainer = document.getElementById('lista-salas-container');
const cadastroOperadorForm = document.getElementById('cadastro-operador-form');
const operadorNomeInput = document.getElementById('operador-nome');
const operadorSenhaInput = document.getElementById('operador-senha');
const salasCheckboxesDiv = document.getElementById('salas-checkboxes');
const listaOperadoresContainer = document.getElementById('lista-operadores-container');
const salutation = document.getElementById('salutation');
const versionDisplay = document.getElementById('version-display');
const dataForm = document.getElementById('data-form');
const salaSelect = document.getElementById('sala-select');
const colecaoSelect = document.getElementById('colecao-select');
const dataInicialInput = document.getElementById('data-inicial-input');
const dataFinalInput = document.getElementById('data-final-input');
const dataContainer = document.getElementById('data-container');
const messageContainer = document.getElementById('message-container');
const loadingSpinner = document.getElementById('loading-spinner');
const errorDisplay = document.getElementById('error-message');
const cartoesBtn = document.getElementById('cartoes-btn');
const tabelaBtn = document.getElementById('tabela-btn');
const logoutBtnOptions = document.getElementById('logout-btn-options');

// Botões de consultas
const saldoBtn = document.getElementById('saldo-btn');
const especiaisBtn = document.getElementById('especiais-btn');
const vendasBtn = document.getElementById('vendas-btn');
const contadoresBtn = document.getElementById('contadores-btn');

// Elemento para o grupo de datas, pois este precisa ser controlado
const dataFormGroup = document.getElementById('data-form-group');

let salasPermitidas = [];
let operadorLogado = '';
let colecaoSelecionada = '';
let salaSelecionada = '';
let lastFetchedData = null;
const COLECOES_SEM_FILTRO_DATA = ['agenda', 'casa', 'atendentes'];
const COLECOES_SEM_FILTRO_COMPLETO = ['clientes'];

function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
}

// Função para exibir telas
function showScreen(screen) {
    document.querySelectorAll('#app > div').forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');

    if (screen === dashboardScreen) {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        dataInicialInput.value = todayStr;
        dataFinalInput.value = todayStr;
    }
}

// Inicialização e autenticação
document.addEventListener('DOMContentLoaded', () => {
    operadorLogado = localStorage.getItem('operadorLogado');
    const idsalas = JSON.parse(localStorage.getItem('salasPermitidas'));

    console.log('Verificando login... Operador:', operadorLogado, 'Salas:', idsalas);

    if (operadorLogado && idsalas) {
        salasPermitidas = idsalas;
        updateOperatorNameDisplay();

        if (operadorLogado.toUpperCase() === 'TECBIN') {
            showScreen(tecbinsOptionsScreen);
            setupBtn.classList.remove('hidden');
            agendarAtendimentoBtn.classList.remove('hidden'); // TECBIN pode agendar
            populateAllSalasSelect();
        } else {
            showScreen(tecbinsOptionsScreen); // Não-TECBIN também vê a tela de opções
            setupBtn.classList.add('hidden');
            agendarAtendimentoBtn.classList.remove('hidden'); // Não-TECBIN pode agendar
        }

        populateColecaoSelect();
    } else {
        showScreen(loginScreen);
    }
});

function updateOperatorNameDisplay() {
    const operatorDisplays = document.querySelectorAll('.operator-name-display');
    operatorDisplays.forEach(el => {
        el.textContent = operadorLogado ? `Operador: ${operadorLogado}` : '';
    });
}

async function login(operador, senha) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operador, senha })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('operadorLogado', data.nome);
            localStorage.setItem('salasPermitidas', JSON.stringify(data.idsalas));
            operadorLogado = data.nome;
            salasPermitidas = data.idsalas;
            updateOperatorNameDisplay();

            showScreen(tecbinsOptionsScreen);

            if (operadorLogado.toUpperCase() === 'TECBIN') {
                setupBtn.classList.remove('hidden');
                agendarAtendimentoBtn.classList.remove('hidden');
                populateAllSalasSelect();
            } else {
                setupBtn.classList.add('hidden');
                agendarAtendimentoBtn.classList.remove('hidden');
            }
            populateColecaoSelect();
        } else {
            loginMessage.textContent = data.message;
            loginMessage.className = 'text-center mt-4 text-sm text-red-500';
        }
    } catch (error) {
        console.error('Erro de login:', error);
        loginMessage.textContent = 'Erro ao conectar com o servidor.';
        loginMessage.className = 'text-center mt-4 text-sm text-red-500';
    }
}

function logout() {
    localStorage.removeItem('operadorLogado');
    localStorage.removeItem('salasPermitidas');
    operadorLogado = '';
    salasPermitidas = [];
    window.location.reload();
}

async function fetchSalas() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/salas`);
        if (!response.ok) throw new Error('Não foi possível carregar as salas.');
        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar salas:', error);
        return [];
    }
}

async function fetchColecoes() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/tabelas`);
        if (!response.ok) throw new Error('Não foi possível carregar as coleções.');
        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar coleções:', error);
        return [];
    }
}

async function populateSalaSelect(idsalasPermitidas) {
    const salas = await fetchSalas();
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    const filteredSalas = salas.filter(sala => idsalasPermitidas.includes(sala.idsala));
    filteredSalas.forEach(sala => {
        const option = document.createElement('option');
        option.value = sala.idsala;
        option.textContent = sala.nomesala;
        salaSelect.appendChild(option);
    });
}

async function populateAllSalasSelect() {
    const salas = await fetchSalas();
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salas.forEach(sala => {
        const option = document.createElement('option');
        option.value = sala.idsala;
        option.textContent = sala.nomesala;
        salaSelect.appendChild(option);
    });
}

async function populateColecaoSelect() {
    const colecoes = await fetchColecoes();
    colecaoSelect.innerHTML = '<option value="">Selecione...</option>';
    const colecoesBase = new Set();
    const colecoesIgnoradas = ['sala', 'salas', 'operador', 'operadores', 'funcionario', 'funcionarios', 'controle_de_ids', 'controle_de_versao'];

    colecoes.forEach(colecao => {
        const nomeBase = colecao.replace(/\d+$/, '');
        if (!colecoesIgnoradas.includes(nomeBase.toLowerCase()) && !COLECOES_SEM_FILTRO_DATA.includes(nomeBase) && !COLECOES_SEM_FILTRO_COMPLETO.includes(nomeBase)) {
            colecoesBase.add(nomeBase);
        }
    });

    COLECOES_SEM_FILTRO_COMPLETO.forEach(nomeBase => {
        const option = document.createElement('option');
        option.value = nomeBase;
        option.textContent = nomeBase;
        colecaoSelect.appendChild(option);
    });

    COLECOES_SEM_FILTRO_DATA.forEach(nomeBase => {
        const option = document.createElement('option');
        option.value = nomeBase;
        option.textContent = nomeBase;
        colecaoSelect.appendChild(option);
    });

    Array.from(colecoesBase).sort().forEach(nomeBase => {
        const option = document.createElement('option');
        option.value = nomeBase;
        option.textContent = nomeBase;
        colecaoSelect.appendChild(option);
    });
}

async function renderSalasList() {
    const salas = await fetchSalas();
    listaSalasContainer.innerHTML = '';
    salas.forEach(sala => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-gray-700 p-3 rounded-md';
        item.innerHTML = `
            <span>${sala.nomesala} (${sala.idsala})</span>
            <div>
                <button class="text-blue-400 hover:text-blue-200 edit-sala-btn" data-id="${sala.idsala}" data-nome="${sala.nomesala}">Editar</button>
                <button class="text-red-400 hover:text-red-200 delete-sala-btn" data-id="${sala.idsala}">Excluir</button>
            </div>
        `;
        listaSalasContainer.appendChild(item);
    });
}

async function renderOperadoresList() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/operadores`);
        if (!response.ok) throw new Error('Falha ao carregar operadores');
        const operadores = await response.json();
        listaOperadoresContainer.innerHTML = '';
        operadores.forEach(operador => {
            const idsalas = operador.idsalas ? operador.idsalas.join(', ') : 'Nenhuma';
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center bg-gray-700 p-3 rounded-md';
            item.innerHTML = `
                <div>
                    <p class="font-bold">${operador.nome}</p>
                    <p class="text-sm text-gray-400">Salas: ${idsalas}</p>
                </div>
                <div>
                    <button class="text-blue-400 hover:text-blue-200 edit-operador-btn" data-nome="${operador.nome}">Editar</button>
                    ${operador.nome.toUpperCase() !== 'TECBIN' ? `<button class="text-red-400 hover:text-red-200 delete-operador-btn" data-nome="${operador.nome}">Excluir</button>` : ''}
                </div>
            `;
            listaOperadoresContainer.appendChild(item);
        });
    } catch (error) {
        console.error("Erro ao renderizar a lista de operadores:", error);
    }
}

function showMessage(container, message, type) {
    container.textContent = message;
    container.className = `text-center mt-4 text-sm ${type === 'success' ? 'text-green-500' : 'text-red-500'}`;
}

async function renderSalasCheckboxes() {
    const salas = await fetchSalas();
    salasCheckboxesDiv.innerHTML = '';
    salas.forEach(sala => {
        const div = document.createElement('div');
        div.className = 'flex items-center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sala-${sala.idsala}`;
        checkbox.value = sala.idsala;
        checkbox.className = 'mr-2';
        const label = document.createElement('label');
        label.htmlFor = `sala-${sala.idsala}`;
        label.textContent = `${sala.nomesala} (${sala.idsala})`;
        div.appendChild(checkbox);
        div.appendChild(label);
        salasCheckboxesDiv.appendChild(div);
    });
}

// Funções de formatação
function formatCurrency(value) {
    if (typeof value !== 'number') {
        value = parseFloat(value) || 0;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// NOVO: Renderiza o cartão de saldo
function renderSaldoCard(data, dataInicial, dataFinal) {
    dataContainer.innerHTML = '';
    const { saldoEntradas, saldoSaidas, saldoDiario, especiais, vendaBar, taxaPgtos, atendentesPgs, despesas, vales } = data;

    // Formata as datas antes de usá-las
    const dataInicialFormatada = formatDateForDisplay(dataInicial);
    const dataFinalFormatada = formatDateForDisplay(dataFinal);

    // Lógica para formatar a data ou período
    let periodoTexto;
    if (dataInicial === dataFinal) {
        periodoTexto = dataInicialFormatada;
    } else {
        periodoTexto = `${dataInicialFormatada} a ${dataFinalFormatada}`;
    }

    const cardHtml = `
        <div class="bg-gray-700 p-4 rounded-lg shadow-xl  text-white">
            <h2 class="text-2xl mb-2 p0 text-center">Resumo da Movimentação  (${periodoTexto})</h2>
            <div class="flex justify-between items-start mb-2">
                <div class="bg-gray-800 p-2 w-1/2 pr-4 border-r border-gray-600">
                    <h3 class="text-xl font-semibold mb-2 text-green-400">Entradas</h3>
                    <ul class="space-y-2">
                        <li>
                            <span class="font-medium">Especiais:</span>
                            <span class="text-lg float-right">${formatCurrency(especiais)}</span>
                        </li>
                        <li>
                            <span class="font-medium">Venda Bar:</span>
                            <span class="text-lg float-right">${formatCurrency(vendaBar)}</span>
                        </li>
                        <li>
                            <span class="font-medium">Taxa Pgtos:</span>
                            <span class="text-lg float-right">${formatCurrency(taxaPgtos)}</span>
                        </li>
                    </ul>
                    <div class=" mt-4 pt-4 border-t border-gray-600">
                        <p class="text-lg font-bold text-green-500">
                            Total Entradas: <span class="float-right">${formatCurrency(saldoEntradas)}</span>
                        </p>
                    </div>
                </div>

                <div class="bg-gray-800 p-2 w-1/2 pl-4">
                    <h3 class="text-xl font-semibold mb-2 text-red-400">Saídas</h3>
                    <ul class="space-y-2">
                        <li>
                            <span class="font-medium">Atendentes Pgs:</span>
                            <span class="text-lg float-right">${formatCurrency(atendentesPgs)}</span>
                        </li>
                        <li>
                            <span class="font-medium">Despesas:</span>
                            <span class="text-lg float-right">${formatCurrency(despesas)}</span>
                        </li>
                        <li>
                            <span class="font-medium">Vales:</span>
                            <span class="text-lg float-right">${formatCurrency(vales)}</span>
                        </li>
                    </ul>
                    <div class=" mt-4 pt-4 border-t border-gray-600">
                        <p class="text-lg font-bold text-red-500">
                            Total Saídas: <span class="float-right">${formatCurrency(saldoSaidas)}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div class="mt-4 bg-gray-800 text-center pt-2 border-t border-gray-600">
                <p class="text-2xl font-bold text-yellow-400">
                    Saldo da Movimentação: ${formatCurrency(saldoDiario)}
                </p>
            </div>
        </div>
    `;
    dataContainer.innerHTML = cardHtml;
}

// NOVO: Função para buscar e renderizar o saldo
async function fetchAndRenderSaldo() {
    clearResults();
    const idsala = salaSelect.value;
    const dataInicial = dataInicialInput.value;
    const dataFinal = dataFinalInput.value;

    if (!idsala) {
        showMessage(messageContainer, "Por favor, selecione uma sala.", "error");
        return;
    }

    loadingSpinner.classList.remove('hidden');

    try {
        const url = `${BACKEND_URL}/api/saldo-total?idsala=${idsala}&data_inicial=${dataInicial}&data_final=${dataFinal}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            renderSaldoCard(data, dataInicial, dataFinal);
            messageContainer.textContent = '';
        } else {
            showMessage(messageContainer, data.error || "Erro ao buscar os dados.", "error");
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        showMessage(messageContainer, "Não foi possível conectar ao servidor para buscar o saldo.", "error");
    } finally {
        loadingSpinner.classList.add('hidden');
    }
}

// Função para buscar e renderizar os contadores
async function fetchAndRenderContadores() {
    clearResults();
    loadingSpinner.classList.remove('hidden');

    const idsala = salaSelect.value;
    const dataInicial = dataInicialInput.value;
    const dataFinal = dataFinalInput.value;

    if (!idsala || !dataInicial || !dataFinal) {
        loadingSpinner.classList.add('hidden');
        messageContainer.textContent = 'Por favor, selecione uma sala e um período para a consulta.';
        return;
    }

    try {
        const url = `${BACKEND_URL}/api/contadores?idsala=${idsala}&data_inicial=${dataInicial}&data_final=${dataFinal}`;
        const response = await fetch(url);
        const data = await response.json();
        
        loadingSpinner.classList.add('hidden');

        if (response.ok) {
            renderContadoresCards(data, dataInicial, dataFinal);
        } else {
            messageContainer.textContent = data.error || 'Erro ao buscar dados do backend.';
        }
    } catch (error) {
        loadingSpinner.classList.add('hidden');
        messageContainer.textContent = 'Erro de conexão. Verifique o servidor.';
        console.error('Erro na requisição:', error);
    }
}

// Função para renderizar os cartões de contadores
// Função para renderizar os cartões de contadores
function renderContadoresCards(data, dataInicial, dataFinal) {
    dataContainer.innerHTML = '';
    
    // Lógica para formatar a data ou período
    const dataInicialFormatada = formatDateForDisplay(dataInicial);
    const dataFinalFormatada = formatDateForDisplay(dataFinal);
    let periodoTexto;
    if (dataInicial === dataFinal) {
        periodoTexto = dataInicialFormatada;
    } else {
        periodoTexto = `${dataInicialFormatada} a ${dataFinalFormatada}`;
    }

// Função auxiliar para criar um cartão (sem a data no título)
    const createCard = (title, items) => {
    let itemsHtml = '';
    for (const key in items) {
        itemsHtml += `
            <li class="flex justify-between items-center py-0 border-b border-gray-600">
                <span class="font-sm  text-gray-400">${key}:</span>
                <span class="font-sm font-bold text-yellow-200">${items[key]}</span>
            </li>
        `;
    }
    return `
        <div class="bg-gray-800 p-2 rounded-lg shadow-xl text-white">
            <h3 class="text-xl  text-center mb-2 text-blue-400 font-sans">${title}</h3>
            <ul class="space-y-2">
                ${itemsHtml}
            </ul>
        </div>
    `;
    };

    // Cria o contêiner principal e adiciona a data no topo
    const mainContainer = document.createElement('div');
    mainContainer.className = 'w-full';
    mainContainer.innerHTML = `
        <h2 class="text-xl  font-bold text-center mb-0 text-red-500">Contadores Resumidos (${periodoTexto})</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            </div>
    `;

    // Seleciona o contêiner dos cartões para inserir os cartões
    const cardsGrid = mainContainer.querySelector('div.grid');

    // Renderiza cada cartão e o adiciona ao grid
    cardsGrid.innerHTML += createCard(`Especiais`, data.especial);
    cardsGrid.innerHTML += createCard(`Vendas`, data.vendas);
    cardsGrid.innerHTML += createCard(`Atendentes`, data.atendentes);
    cardsGrid.innerHTML += createCard(`Comandas`, data.comanda);
    cardsGrid.innerHTML += createCard(`Agenda`, data.agenda);

    dataContainer.appendChild(mainContainer);
}

// Mantenha a função auxiliar para formatar a data, se ela não estiver no seu código
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
}

// Listeners
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const operador = e.target.operador.value.trim();
    const senha = e.target.senha.value;
    login(operador, senha);
});

acessarConsultaBtn.addEventListener('click', () => {
    if (operadorLogado) {
        showScreen(dashboardScreen);
        populateSalaSelect(salasPermitidas);
        if (salasPermitidas.length > 0) {
            salaSelect.value = salasPermitidas[0];
        }

        const event = new Event('submit', { cancelable: true });
        dataForm.dispatchEvent(event);
    }
});

agendarAtendimentoBtn.addEventListener('click', () => {
    window.location.href = `agendamento.html?operador=${operadorLogado}&salas=${JSON.stringify(salasPermitidas)}`;
});

setupBtn.addEventListener('click', () => {
    if (operadorLogado) {
        showScreen(setupOptionsScreen);
    }
});
logoutBtn.addEventListener('click', () => showScreen(tecbinsOptionsScreen));
logoutFromSetupBtn.addEventListener('click', logout);
logoutFromTecbinsOptionsBtn.addEventListener('click', logout);
voltarBtn.addEventListener('click', () => showScreen(tecbinsOptionsScreen));
voltarSetupSalaBtn.addEventListener('click', () => showScreen(setupOptionsScreen));
voltarSetupOperadorBtn.addEventListener('click', () => showScreen(setupOptionsScreen));
cadastrarSalaBtn.addEventListener('click', () => {
    showScreen(cadastroSalaScreen);
    renderSalasList();
});

cadastroOperadorBtn.addEventListener('click', () => {
    showScreen(cadastroOperadorScreen);
    renderOperadoresList();
    renderSalasCheckboxes();
});

cadastroSalaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = nomeSalaInput.value;
    const id = idSalaInput.value;
    const isEditing = e.target.dataset.editing === 'true';
    const originalId = e.target.dataset.originalId;

    try {
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `${BACKEND_URL}/api/salas/${originalId}` : `${BACKEND_URL}/api/salas/cadastro`;
        const body = JSON.stringify({ nome, id });

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        const data = await response.json();
        showMessage(document.getElementById('cadastro-sala-message'), data.message, response.ok ? 'success' : 'error');
        if (response.ok) {
            cadastroSalaForm.reset();
            delete cadastroSalaForm.dataset.editing;
            delete cadastroSalaForm.dataset.originalId;
            document.getElementById('submit-sala-btn').textContent = 'Cadastrar';
            renderSalasList();
            populateSalaSelect(salasPermitidas);
        }
    } catch (error) {
        showMessage(document.getElementById('cadastro-sala-message'), "Erro de conexão com o servidor.", 'error');
    }
});

document.getElementById('cancelar-sala-btn').addEventListener('click', () => {
    cadastroSalaForm.reset();
    delete cadastroSalaForm.dataset.editing;
    delete cadastroSalaForm.dataset.originalId;
    document.getElementById('submit-sala-btn').textContent = 'Cadastrar';
    document.getElementById('cadastro-sala-message').textContent = '';
});

listaSalasContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-sala-btn')) {
        const id = e.target.dataset.id;
        const nome = e.target.dataset.nome;
        nomeSalaInput.value = nome;
        idSalaInput.value = id;
        idSalaInput.disabled = true;
        cadastroSalaForm.dataset.editing = 'true';
        cadastroSalaForm.dataset.originalId = id;
        document.getElementById('submit-sala-btn').textContent = 'Atualizar';
    }
    if (e.target.classList.contains('delete-sala-btn')) {
        const id = e.target.dataset.id;
        if (confirm(`Tem certeza que deseja excluir a sala com ID ${id}?`)) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/salas/${id}`, { method: 'DELETE' });
                const data = await response.json();
                showMessage(document.getElementById('cadastro-sala-message'), data.message, response.ok ? 'success' : 'error');
                if (response.ok) {
                    renderSalasList();
                    populateSalaSelect(salasPermitidas);
                }
            } catch (error) {
                showMessage(document.getElementById('cadastro-sala-message'), "Erro de conexão com o servidor.", 'error');
            }
        }
    }
});

cadastroOperadorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = operadorNomeInput.value;
    const senha = operadorSenhaInput.value;
    const isEditing = e.target.dataset.editing === 'true';
    const idsalas = Array.from(salasCheckboxesDiv.querySelectorAll('input:checked')).map(cb => cb.value);
    const originalNome = e.target.dataset.originalNome;

    try {
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `${BACKEND_URL}/api/operadores/${originalNome}` : `${BACKEND_URL}/api/operadores/cadastro`;
        const body = JSON.stringify({ nome, senha, idsalas });

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        const data = await response.json();
        showMessage(document.getElementById('cadastro-operador-message'), data.message, response.ok ? 'success' : 'error');
        if (response.ok) {
            cadastroOperadorForm.reset();
            delete cadastroOperadorForm.dataset.editing;
            delete cadastroOperadorForm.dataset.originalNome;
            operadorNomeInput.disabled = false;
            operadorSenhaInput.placeholder = '';
            document.getElementById('submit-operador-btn').textContent = 'Cadastrar';
            renderOperadoresList();
            renderSalasCheckboxes();
        }
    } catch (error) {
        showMessage(document.getElementById('cadastro-operador-message'), "Erro de conexão com o servidor.", 'error');
    }
});

document.getElementById('cancelar-operador-btn').addEventListener('click', () => {
    cadastroOperadorForm.reset();
    delete cadastroOperadorForm.dataset.editing;
    delete cadastroOperadorForm.dataset.originalId;
    operadorNomeInput.disabled = false;
    operadorSenhaInput.placeholder = '';
    document.getElementById('submit-operador-btn').textContent = 'Cadastrar';
    document.getElementById('cadastro-operador-message').textContent = '';
    renderSalasCheckboxes();
});

listaOperadoresContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-operador-btn')) {
        const nome = e.target.dataset.nome;
        const operadores = await (await fetch(`${BACKEND_URL}/api/operadores`)).json();
        const operador = operadores.find(op => op.nome === nome);
        if (operador) {
            operadorNomeInput.value = operador.nome;
            operadorNomeInput.disabled = true;
            operadorSenhaInput.value = '';
            operadorSenhaInput.placeholder = 'Deixe em branco para não alterar';
            cadastroOperadorForm.dataset.editing = 'true';
            cadastroOperadorForm.dataset.originalNome = nome;
            document.getElementById('submit-operador-btn').textContent = 'Atualizar';

            await renderSalasCheckboxes();
            operador.idsalas.forEach(id => {
                const checkbox = document.getElementById(`sala-${id}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
    }
    if (e.target.classList.contains('delete-operador-btn')) {
        const nome = e.target.dataset.nome;
        if (confirm(`Tem certeza que deseja excluir o operador ${nome}?`)) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/operadores/${nome}`, { method: 'DELETE' });
                const data = await response.json();
                showMessage(document.getElementById('cadastro-operador-message'), data.message, response.ok ? 'success' : 'error');
                if (response.ok) {
                    renderOperadoresList();
                }
            } catch (error) {
                showMessage(document.getElementById('cadastro-operador-message'), "Erro de conexão com o servidor.", 'error');
            }
        }
    }
});

function showViewButtons() {
    const botoesViewContainer = document.getElementById('botoes-view-container');
    if (botoesViewContainer) {
        botoesViewContainer.classList.remove('hidden');
    }
}

function hideViewButtons() {
    const botoesViewContainer = document.getElementById('botoes-view-container');
    if (botoesViewContainer) {
        botoesViewContainer.classList.add('hidden');
    }
}

if (dataForm) {
    console.log('Elemento dataForm encontrado. Adicionando listener...');
    dataForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        clearResults();

        const colecaoBase = colecaoSelect.value;
        const salaSelecionada = salaSelect.value;
        const dataInicial = dataInicialInput.value;
        const dataFinal = dataFinalInput.value;

        console.log('tabela de buscada', colecaoBase);
        // --- NOVO BLOCO DE VERIFICAÇÃO ---
        if (!colecaoBase) {
            showMessage(messageContainer, 'Por favor, selecione uma coleção (tabela).', 'error');
            return; // Impede a continuação da função
        }
        // CRÍTICO: Cria a data de hoje para comparação, sem a hora, garantindo consistência
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // CRÍTICO: Cria as datas de busca com o mesmo formato, sem a hora, para garantir precisão
        const dataInicialObj = new Date(dataInicial + 'T00:00:00');
        const dataFinalObj = new Date(dataFinal + 'T00:00:00');

        // Se a coleção não é uma das de exceção, valida todas as regras de data
        if (!COLECOES_SEM_FILTRO_COMPLETO.includes(colecaoBase) && colecaoBase !== 'agenda') {
            if (!salaSelecionada || !dataInicial || !dataFinal) {
                showMessage(messageContainer, 'Por favor, selecione uma sala e preencha as datas.', 'error');
                return;
            }

            if (dataFinalObj < dataInicialObj) {
                showMessage(messageContainer, 'A data final deve ser maior ou igual à data inicial.', 'error');
                return;
            }

            // Regra mais crítica: Se a busca é por um período (datas diferentes), a data final não pode ser hoje.
            if (dataInicialObj.getTime() !== dataFinalObj.getTime() && dataFinalObj.getTime() === today.getTime()) {
                showMessage(messageContainer, 'Para buscas por período, a data final deve ser menor que a data do sistema.', 'error');
                return;
            }

            if (dataFinalObj > today) {
                showMessage(messageContainer, 'A data final deve ser menor ou igual à data do sistema.', 'error');
                return;
            }

            if (dataInicialObj.getMonth() !== dataFinalObj.getMonth() || dataInicialObj.getFullYear() !== dataFinalObj.getFullYear()) {
                showMessage(messageContainer, 'As datas inicial e final devem pertencer ao mesmo mês.', 'error');
                return;
            }

        } else if (!COLECOES_SEM_FILTRO_COMPLETO.includes(colecaoBase) && colecaoBase === 'agenda') {
            if (!salaSelecionada || !dataInicial || !dataFinal) {
                showMessage(messageContainer, 'Para a coleção "agenda", sala e datas são obrigatórias.', 'error');
                return;
            }
        }

        console.log('tabela de base ', colecaoBase);
        loadingSpinner.classList.remove('hidden');

        let url = `${BACKEND_URL}/api/dados?colecao_base=${colecaoBase}`;
        if (!COLECOES_SEM_FILTRO_COMPLETO.includes(colecaoBase)) {
            if (salaSelecionada) {
                url += `&idsala=${salaSelecionada}`;
            }
            if (dataInicial && dataFinal) {
                url += `&data_inicial=${dataInicial}&data_final=${dataFinal}`;
            }
        }

        console.log('url de busca ', url);

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                lastFetchedData = data;
                showViewButtons();
                renderData(lastFetchedData);
                loadingSpinner.classList.add('hidden');
            } else {
                loadingSpinner.classList.add('hidden');
                showMessage(messageContainer, data.error || 'Erro ao buscar dados.', 'error');
            }
        } catch (error) {
            loadingSpinner.classList.add('hidden');
            console.error('Erro de conexão:', error);
            showMessage(messageContainer, 'Erro ao conectar com o servidor.', 'error');
        }
    });

    // Função para limpar os resultados
    function clearResults() {
        dataContainer.innerHTML = '';
        messageContainer.textContent = '';
        lastFetchedData = null;
        hideViewButtons();
    }

    // Limpa os resultados quando a sala, tabela ou datas são alteradas
    salaSelect.addEventListener('change', clearResults);
//    colecaoSelect.addEventListener('change', clearResults);
    colecaoSelect.addEventListener('change', () => {
    // Limpa os resultados
        clearResults();

        const selectedColecao = colecaoSelect.value;
    // Verifica se a coleção selecionada está na lista de coleções sem filtro de data
        if (COLECOES_SEM_FILTRO_DATA.includes(selectedColecao)) {
            dataFormGroup.classList.add('hidden');
        } else {
            dataFormGroup.classList.remove('hidden');
        }
    });
    dataInicialInput.addEventListener('change', clearResults);
    dataFinalInput.addEventListener('change', clearResults);
}
// Nova função para formatar valores
function formatValue(key, value) {
    if (typeof value === 'number' || (typeof value === 'string' && (key.includes('valor') || key.includes('desconto') || key.includes('taxa') || key.includes('em pix')))) {
        const floatValue = parseFloat(value);
        if (!isNaN(floatValue)) {
            return floatValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    }
    return value;
}

// Função auxiliar para verificar se um valor é considerado vazio
function isEmptyValue(value, key) {
    // Trata null, undefined, string vazia e a string "null"
    if (value === null || value === undefined || value === '' || value === 'null') {
        return true;
    }
    // Trata o caso específico de "em pix" com valor 0
    if (key && key.includes('em pix') && value === 0) {
        return true;
    }
    return false;
}

function formatDayForDisplay(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('/');
    if (parts.length === 3) {
        return parts[0];
    }
    return dateString;
}

function renderData(data) {
    dataContainer.innerHTML = '';

    if (data.length === 0) {
        messageContainer.textContent = 'Nenhum dado encontrado para o período selecionado.';
        messageContainer.className = 'text-center mt-4 text-sm text-yellow-500';
        return;
    }

    const isTable = dataContainer.classList.contains('table-view');

    if (isTable) {
        renderDataTable(data);
    } else {
        renderDataCards(data);
    }
}

function renderDataCards(data) {
    const cardGrid = document.createElement('div');
    cardGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

    const ignoredKeys = ['_id', 'id', 'idsala'];

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 p-4 rounded-lg shadow-md';
        let cardContent = '';
        for (const key in item) {
            const value = item[key];
            if (!ignoredKeys.includes(key) && key !== 'idcliente' && !isEmptyValue(value, key)) {
                let displayValue = value;
                if (key === 'dia_movimento') {
                    displayValue = formatDayForDisplay(value);
                } else if (key.includes('valor') || key.includes('em pix')) {
                    displayValue = formatValue(key, value);
                }
                cardContent += `<p class="text-sm"><span class="">${key.replace(/_/g, ' ').toUpperCase()}:</span> <span class="font-bold">${displayValue}</span></p>`;
            }
        }
        card.innerHTML = cardContent;
        cardGrid.appendChild(card);
    });
    dataContainer.appendChild(cardGrid);
}

function renderDataTable(data) {
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-700';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const allKeys = new Set();
    // CORREÇÃO: Adicione 'idcliente' à lista de chaves ignoradas
    const ignoredKeys = new Set(['_id', 'id', 'idsala', 'idcliente']);

    // Passa pelos dados para coletar apenas as chaves de campos que contêm valores válidos
    data.forEach(item => {
        Object.keys(item).forEach(key => {
            const value = item[key];
            if (!isEmptyValue(value, key) && !ignoredKeys.has(key)) {
                allKeys.add(key);
            }
        });
    });

    const headerKeys = Array.from(allKeys);
    headerKeys.forEach(key => {
        const th = document.createElement('th');
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider';

        let headerText = key.replace(/_/g, ' ').toUpperCase();
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'bg-gray-800 divide-y divide-gray-700';

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-700 transition-colors duration-200';
        headerKeys.forEach(key => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-300';
            const value = item[key];

            let displayValue = '';
            if (!isEmptyValue(value, key)) {
                if (key === 'dia_movimento') {
                    displayValue = formatDayForDisplay(value);
                } else if (key.includes('valor') || key.includes('em pix')) {
                    displayValue = formatValue(key, value);
                } else {
                    displayValue = value;
                }
            }
            td.textContent = displayValue;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    dataContainer.appendChild(table);
}

cartoesBtn.addEventListener('click', () => {
    if (lastFetchedData) {
        dataContainer.classList.remove('table-view');
        dataContainer.classList.add('card-view');
        renderData(lastFetchedData);
    }
});

tabelaBtn.addEventListener('click', () => {
    if (lastFetchedData) {
        dataContainer.classList.remove('card-view');
        dataContainer.classList.add('table-view');
        renderData(lastFetchedData);
    }
});
function clearResults() {
    dataContainer.innerHTML = '';
    messageContainer.textContent = '';
    lastFetchedData = null;
}

// Limpa os resultados quando a sala, tabela ou datas são alteradas
salaSelect.addEventListener('change', clearResults);
//colecaoSelect.addEventListener('change', clearResults);
colecaoSelect.addEventListener('change', () => {
    // Limpa os resultados
    clearResults();

    const selectedColecao = colecaoSelect.value;
    // Verifica se a coleção selecionada está na lista de coleções sem filtro de data
    if (COLECOES_SEM_FILTRO_DATA.includes(selectedColecao)) {
        dataFormGroup.classList.add('hidden');
    } else {
        dataFormGroup.classList.remove('hidden');
    }
});
dataInicialInput.addEventListener('change', clearResults);
dataFinalInput.addEventListener('change', clearResults);

// Listener para o novo botão Saldo Atual
saldoBtn.addEventListener('click', fetchAndRenderSaldo);
// Listener para o novo botão Contadores
contadoresBtn.addEventListener('click', fetchAndRenderContadores);

