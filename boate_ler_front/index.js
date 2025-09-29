import express from 'express';
import { MongoClient, ServerApiVersion } from 'mongodb';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let VERSION = "0.0.0"; // Versão agora é dinâmica

const MONGO_URI = "mongodb+srv://rivaldosp:TecBin24@cluster0.jco0sqs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "TecBoate";

const app = express();
const port = process.env.env || 8080;

// =========================================================================
// MIDDLEWARE - DEVEM VIR ANTES DAS ROTAS
// =========================================================================
app.use(cors());
app.use(express.json());

let db;
let client;

// Nova função para buscar e atualizar a versão (versão corrigida)
async function _getAndUpdateVersion() {
    const versionCollection = db.collection("controle_de_versao");
    const versionDoc = await versionCollection.findOneAndUpdate(
        { _id: "backend_version" },
        { $inc: { major: 0, minor: 0, patch: 1 } },
        { returnDocument: 'after', upsert: true }
    );

    console.log("---------------------------------------");
    console.log("Iniciando a verificação de versão.");
    const docValue = versionDoc?.value;
    console.log("Documento retornado do banco (versionDoc):", docValue);

    if (!docValue) {
        console.log("Documento de versão não encontrado. Retornando '0.0.1'.");
        return "0.0.1";
    }

    const { major, minor, patch } = docValue;
    const newVersion = `${major || 0}.${minor || 0}.${patch}`;

    console.log(`Versão encontrada no banco: ${major}.${minor}.${patch}`);
    console.log(`Versão final a ser usada: ${newVersion}`);
    console.log("---------------------------------------");

    return newVersion;
}

// Nova função para determinar o nome da coleção com base na data
function getCollectionNameWithDate(baseName, dateStr) {
    if (!dateStr) {
        return baseName;
    }

    const initialDateParts = dateStr.split('-');
    const initialDate = new Date(parseInt(initialDateParts[0]), parseInt(initialDateParts[1]) - 1, parseInt(initialDateParts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (initialDate.getTime() === today.getTime()) {
        return baseName;
    } else {
        const mes = String(initialDate.getMonth() + 1).padStart(2, '0');
        const ano = initialDate.getFullYear();
        return `${baseName}${mes}${ano}`;
    }
}

// =========================================================================
// ROTAS DE API - DEVEM ESTAR SEMPRE NO MEIO
// =========================================================================
// NOVA ROTA: Contadores
app.get('/api/contadores', async (req, res) => {
    console.log("---------------------------------------");
    console.log("Requisição de contadores recebida.");
    console.log("Parâmetros de requisição:", req.query);
    console.log("---------------------------------------");

    const { idsala, data_inicial, data_final } = req.query;

    if (!idsala) {
        return res.status(400).json({ error: 'Parâmetro idsala é obrigatório.' });
    }

    try {
        const startDate = new Date(data_inicial);
        const endDate = new Date(`${data_final}T23:59:59.999Z`);
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        // Função para contar documentos com filtros
        const countDocuments = async (baseName, matchConditions, useDateFilter = true) => {
            const collectionName = getCollectionNameWithDate(baseName, data_inicial);
            const collection = db.collection(collectionName);
            const pipeline = [];

           // Adiciona uma fase para limpar a string 'hora' antes de filtrar
           if (baseName === 'agenda' || baseName === 'vendas' || baseName === 'comanda' || baseName === 'especial') {
              pipeline.push({
                  $addFields: {
                      trimmed_hora: { $trim: { input: '$hora' } },
                      trimmed_cancelado: { $trim: { input: '$cancelado' } },
                      trimmed_tipo: { $trim: { input: '$tipo' } },
                      trimmed_cortesia: { $trim: { input: '$cortesia' } },
                      trimmed_comissionada: { $trim: { input: '$comissionada' } },
                      trimmed_ativa: { $trim: { input: '$ativa' } }
                  }
              });
           }

            if (useDateFilter) {
                 pipeline.push({
                    $addFields: {
                        convertedDate: {
                            $dateFromString: {
                                dateString: '$dia_movimento',
                                format: '%d/%m/%Y'
                            }
                        }
                    }
                });
                pipeline.push({
                    $match: {
                        idsala: idsala,
                        convertedDate: { $gte: startDate, $lte: endDate },
                        ...matchConditions
                    }
                });
            } else {
                 pipeline.push({
                    $match: {
                        idsala: idsala,
                        ...matchConditions
                    }
                });
            }

            pipeline.push({
                $count: "total"
            });

            const result = await collection.aggregate(pipeline).toArray();
            return result.length > 0 ? result[0].total : 0;
        };
        
        // Contadores da tabela 'especial'
        const especialGeral = await countDocuments('especial', {});
        const especialCancelados = await countDocuments('especial', { cancelado: /^\s*sim\s*$/i });
        const especialAtivos = await countDocuments('especial', { cancelado: /^\s*nao\s*$/i, operador_final: { $in: ["null"] } });
        const especialFinalizados = await countDocuments('especial', { cancelado: /^\s*nao\s*$/i, operador_final: { $nin: [null, "null"] } });

        const vendasGeral = await countDocuments('vendas', {});
        const vendasClientes = await countDocuments('vendas', { tipo: /^\s*CLIENTE\s*$/i });
        const vendasAtendentes = await countDocuments('vendas', { tipo: /^\s*ATENDENTE\s*$/i });
        const vendasColaboradores = await countDocuments('vendas', { tipo: 'COLABORADOR' });
        const vendasCortesias = await countDocuments('vendas', { cortesia: /^\s*sim\s*$/i });
        const vendasComissionadas = await countDocuments('vendas', { comissionada: /^\s*sim\s*$/i });

        // Contadores da tabela 'atendentes' (SEM FILTRO DE DATA)
        const atendentesGeral = await countDocuments('atendentes', {}, false); // O último parâmetro é `false` para desabilitar o filtro de data

        // Contadores da tabela 'comanda'
        const comandaGeral = await countDocuments('comanda', {});
        const comandaAtivas = await countDocuments('comanda', { ativa: /^\s*sim\s*$/i });
        const comandaFechadas = await countDocuments('comanda', { ativa: /^\s*nao\s*$/i });

        // Contadores da tabela 'agenda'      
        const agendaGeral = await countDocuments('agenda', {}, false);
        const agendaFinalizados = await countDocuments('agenda', {
                              trimmed_hora: { $lt: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
                              },false);
         const agendaPendentes = await countDocuments('agenda', {
                              trimmed_hora: { $gte: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
                              },false);

        res.status(200).json({
            especial: {
                Geral: especialGeral,
                Cancelados: especialCancelados,
                Ativos: especialAtivos,
                Finalizados: especialFinalizados
            },
            vendas: {
                Geral: vendasGeral,
                Clientes: vendasClientes,
                Atendentes: vendasAtendentes,
                Colaboradores: vendasColaboradores,
                Cortesias: vendasCortesias,
                Comissionadas: vendasComissionadas
            },
            atendentes: {
                Presentes: atendentesGeral
            },
            comanda: {
                Geral: comandaGeral,
                Ativas: comandaAtivas,
                Fechadas: comandaFechadas
            },
            agenda: {
                Geral: agendaGeral,
                Finalizados: agendaFinalizados,
                Pendentes: agendaPendentes
            }
        });

    } catch (error) {
        console.error(`[ERRO] A execução foi interrompida.`);
        console.error(`Detalhes do erro:`, error);
        res.status(500).json({ error: "Não foi possível calcular os contadores. Verifique a conexão e os logs do servidor." });
    }
});

// Rota de Saldo Total
app.get('/api/saldo-total', async (req, res) => {
    console.log("---------------------------------------");
    console.log("Requisição de saldo total recebida.");
    console.log("Parâmetros de requisição:", req.query);
    console.log("---------------------------------------");

    const { idsala, data_inicial, data_final } = req.query;

    if (!idsala) {
        return res.status(400).json({ error: 'Parâmetro idsala é obrigatório.' });
    }

    try {
        const startDate = new Date(data_inicial);
        const endDate = new Date(`${data_final}T23:59:59.999Z`);

        // Função para somar valores de uma coleção
        const sumFromCollection = async (baseName, field, additionalMatch = {}) => {
            const collectionName = getCollectionNameWithDate(baseName, data_inicial);
            const collection = db.collection(collectionName);
            const pipeline = [
                {
                    $addFields: {
                        convertedDate: {
                            $dateFromString: {
                                dateString: '$dia_movimento',
                                format: '%d/%m/%Y'
                            }
                        }
                    }
                },
                {
                    $match: {
                        idsala: idsala,
                        convertedDate: { $gte: startDate, $lte: endDate },
                        ...additionalMatch
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: `$${field}` }
                    }
                }
            ];
            const result = await collection.aggregate(pipeline).toArray();
            return result.length > 0 ? result[0].total : 0;
        };


// Função para somar alguns campos e subtrair outros de uma coleção
    const sumAndSubtractFields = async (baseName, fieldsToSum, fieldsToSubtract) => {
    const collectionName = getCollectionNameWithDate(baseName, data_inicial);
    const collection = db.collection(collectionName);
    const pipeline = [
        {
            $addFields: {
                convertedDate: {
                    $dateFromString: {
                        dateString: '$dia_movimento',
                        format: '%d/%m/%Y'
                    }
                }
            }
        },
        {
            $match: {
                idsala: idsala,
                convertedDate: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                totalSum: { $sum: { $sum: fieldsToSum.map(field => `$${field}`) } },
                totalSubtract: { $sum: { $sum: fieldsToSubtract.map(field => `$${field}`) } }
            }
        }
    ];
    const result = await collection.aggregate(pipeline).toArray();
    if (result.length > 0) {
        return result[0].totalSum - result[0].totalSubtract;
    }
    return 0;
};

        const [vendaBar, taxaPgtos, despesas] = await Promise.all([
            sumFromCollection('vendas', 'valor'),
            sumFromCollection('formapgto', 'taxa'),
            sumFromCollection('despesa', 'valor'),
        ]);

        const especiaisPipeline = [
            {
                $match: {
                    idsala: idsala,
                    dia_movimento: { $gte: data_inicial, $lte: data_final }
                }
            },
            {
                $group: {
                    _id: null,
                    suiteTotal: { $sum: "$valor_suite" },
                    atendenteTotal: { $sum: "$valor_atendente" },
                    descontoTotal: { $sum: "$desconto" }
                }
            }
        ];

        const especiais = await sumAndSubtractFields('especial', ['valor_suite', 'valor_atendente'], ['desconto']);
        const atendentesPgs = await sumFromCollection('vales', 'valor', { pgto_atendente: 'Sim' });
        const vales = await sumFromCollection('vales', 'valor', { pgto_atendente: 'Nao' });
        const saldoEntradas = especiais + vendaBar + taxaPgtos;
        const saldoSaidas = atendentesPgs + despesas + vales;
        const saldoDiario = saldoEntradas - saldoSaidas;

        res.status(200).json({
            saldoEntradas: saldoEntradas,
            saldoSaidas: saldoSaidas,
            saldoDiario: saldoDiario,
            especiais: especiais,
            vendaBar: vendaBar,
            taxaPgtos: taxaPgtos,
            atendentesPgs: atendentesPgs,
            despesas: despesas,
            vales: vales
        });

    } catch (error) {
        console.error(`[ERRO] A execução foi interrompida.`);
        console.error(`Detalhes do erro:`, error);
        res.status(500).json({ error: "Não foi possível calcular o saldo. Verifique a conexão e os logs do servidor." });
    }
});

app.get('/api/version', (req, res) => {
    res.status(200).json({ version: VERSION });
});

app.get('/api/dados', async (req, res) => {
    console.log("---------------------------------------");
    console.log("Requisição de busca de dados recebida.");
    console.log("Parâmetros de requisição:", req.query);
    console.log("---------------------------------------");

    const { colecao_base, idsala, data_inicial, data_final, atendente_nome, nome_cliente, idcliente } = req.query;

    if (!colecao_base) {
        console.log("[ERRO] Parâmetro colecao_base está faltando. Retornando 400.");
        return res.status(400).json({ error: 'Parâmetro colecao_base é obrigatório.' });
    }

    let collectionName = colecao_base;
    const isAgendaCollection = colecao_base.endsWith('agenda');
    const COLECOES_SEM_FILTRO_COMPLETO = ['clientes', 'atendentes', 'casa','agenda'];

    try {
        console.log("Iniciando a lógica para determinar a coleção.");

        if (!COLECOES_SEM_FILTRO_COMPLETO.includes(colecao_base) && data_inicial) {
            collectionName = getCollectionNameWithDate(colecao_base, data_inicial);
            console.log(`Decisão: Data é histórica ou futura. Nome da coleção gerado: ${collectionName}`);
        }

        const pipeline = [];
        const matchFilters = {};

        // Adiciona um stage para remover espaços de idsala e dia_movimento se existirem
        pipeline.push({
            $addFields: {
                dia_movimento_limpo: { $trim: { input: "$dia_movimento" } },
                idsala_limpo: { $trim: { input: "$idsala" } }
            }
        });

        // Adiciona o filtro de IDsala
        if (idsala) {
            matchFilters.idsala_limpo = idsala.trim();
        }

        // Adiciona os outros filtros
        if (atendente_nome) {
            matchFilters.atendenteNome = atendente_nome;
        }
        if (nome_cliente) {
            matchFilters.nomeCliente = nome_cliente;
        }
        if (idcliente) {
            matchFilters.idcliente = parseInt(idcliente);
        }

        // **CORREÇÃO:** Adiciona o filtro de data ANTES de adicionar o match
        if (data_inicial && data_final && !COLECOES_SEM_FILTRO_COMPLETO.includes(colecao_base)) {
            const startDate = new Date(data_inicial);
            const endDate = new Date(`${data_final}T23:59:59.999Z`);

            // Adiciona o stage para converter a string de data em um formato de data
            pipeline.push({
                $addFields: {
                    convertedDate: {
                        $dateFromString: {
                            dateString: '$dia_movimento_limpo',
                            format: '%d/%m/%Y'
                        }
                    }
                }
            });

            // Adiciona o filtro de data à query
            matchFilters.convertedDate = {
                $gte: startDate,
                $lte: endDate
            };
        }


        if (Object.keys(matchFilters).length > 0) {
            pipeline.push({ $match: matchFilters });
            console.log("Filtros de busca aplicados:", JSON.stringify(matchFilters, null, 2));
        }

        // Adiciona o stage para remover campos de suporte
        pipeline.push({
            $project: {
                dia_movimento_limpo: 0,
                idsala_limpo: 0,
                convertedDate: 0
            }
        });

        console.log(`Buscando dados na coleção: ${collectionName}`);
        const collection = db.collection(collectionName);
        const data = await collection.aggregate(pipeline).toArray();

        console.log(`Busca concluída. Encontrados ${data.length} resultados.`);
        console.log("---------------------------------------");

        res.status(200).json(data);
    } catch (error) {
        console.error(`[ERRO] A execução foi interrompida.`);
        console.error(`Detalhes do erro:`, error);
        console.error(`Coleção que causou o erro: ${collectionName}`);

        res.status(500).json({ error: "Não foi possível carregar os dados. Verifique a conexão, filtros e logs do servidor." });
    }
});


app.post('/api/login', async (req, res) => {
    try {
        const { operador, senha } = req.body;
        if (!operador || !senha) {
            return res.status(400).json({ message: "Usuário e senha são obrigatórios." });
        }
        const operadorFormatado = operador.toUpperCase();
        const senhaFormatada = senha;
        const operadorEncontrado = await db.collection('operadores').findOne({
            nome: operadorFormatado,
            senha: senhaFormatada
        });
        if (operadorEncontrado) {
            const idsalasLimpos = operadorEncontrado.idsalas.map(id => {
                if (id.includes('TANGUARA')) {
                    return id.trim();
                }
                return id;
            });
            res.status(200).json({
                message: 'Login bem-sucedido',
                nome: operadorEncontrado.nome,
                idsalas: idsalasLimpos
            });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas. Verifique o usuário e a senha.' });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/salas', async (req, res) => {
    try {
        const salasCollection = db.collection('sala');
        const salas = await salasCollection.find({}, { projection: { idsala: 1, nomesala: 1, _id: 0 } }).toArray();
        const salasLimpos = salas.map(sala => ({
            idsala: sala.idsala ? sala.idsala.trim() : null,
            nomesala: sala.nomesala ? sala.nomesala.trim() : null
        }));
        res.status(200).json(salasLimpos);
    } catch (error) {
        console.error("Erro ao buscar a lista de salas:", error);
        res.status(500).json({ error: "Erro ao buscar a lista de salas." });
    }
});

app.post('/api/salas/cadastro', async (req, res) => {
    try {
        const { nome, id } = req.body;
        if (!nome || !id) {
            return res.status(400).json({ message: "Nome e ID da sala são obrigatórios." });
        }
        const nomeFormatado = nome.toUpperCase();
        const idFormatado = id.toUpperCase();
        const salasCollection = db.collection('sala');
        const salaExistente = await salasCollection.findOne({
            $or: [{ nomesala: nomeFormatado }, { idsala: idFormatado }]
        });
        if (salaExistente) {
            return res.status(409).json({ message: "Nome ou ID da sala já existem." });
        }
        const novaSala = {
            nomesala: nomeFormatado,
            idsala: idFormatado
        };
        await salasCollection.insertOne(novaSala);
        res.status(201).json({ message: "Sala cadastrada com sucesso!" });
    } catch (error) {
        console.error("Erro ao cadastrar sala:", error);
        res.status(500).json({ message: "Erro interno do servidor ao cadastrar a sala." });
    }
});

app.put('/api/salas/:id', async (req, res) => {
    const id = req.params.id.toUpperCase();
    try {
        const { nome } = req.body;
        if (!nome) {
            return res.status(400).json({ message: "Nome da sala é obrigatório para atualização." });
        }
        const salasCollection = db.collection('sala');
        const result = await salasCollection.updateOne(
            { idsala: id },
            { $set: { nomesala: nome.toUpperCase() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Sala não encontrada." });
        }
        res.status(200).json({ message: "Sala atualizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar sala:", error);
        res.status(500).json({ message: "Erro interno do servidor ao atualizar a sala." });
    }
});

app.delete('/api/salas/:id', async (req, res) => {
    const id = req.params.id.toUpperCase();
    try {
        const salasCollection = db.collection('sala');
        const result = await salasCollection.deleteOne({ idsala: id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Sala não encontrada." });
        }
        res.status(200).json({ message: "Sala excluída com sucesso!" });
    } catch (error) {
        console.error("Erro ao excluir sala:", error);
        res.status(500).json({ message: "Erro interno do servidor ao excluir a sala." });
    }
});

app.get('/api/operadores', async (req, res) => {
    try {
        const operadores = await db.collection('operadores').find({}, { projection: { nome: 1, idsalas: 1, _id: 0 } }).toArray();
        res.status(200).json(operadores);

console.error("passei :");
    } catch (error) {
        console.error("Erro ao buscar a lista de operadores:", error);
        res.status(500).json({ error: "Erro ao buscar a lista de operadores." });
    }
});

app.post('/api/operadores/cadastro', async (req, res) => {
    try {
        const { nome, senha, idsalas } = req.body;
        if (!nome || !senha || !idsalas || idsalas.length === 0) {
            return res.status(400).json({ message: "Nome, senha e pelo menos uma sala de acesso são obrigatórios." });
        }
        const operadoresCollection = db.collection('operadores');
        const nomeFormatado = nome.toUpperCase();
        const operadorExistente = await operadoresCollection.findOne({ nome: nomeFormatado });
        if (operadorExistente) {
            return res.status(409).json({ message: "Nome de operador já existe." });
        }
        const novoOperador = { nome: nomeFormatado, senha: senha, idsalas: idsalas };
        await operadoresCollection.insertOne(novoOperador);
        res.status(201).json({ message: "Operador cadastrado com sucesso!" });
    } catch (error) {
        console.error("Erro ao cadastrar operador:", error);
        res.status(500).json({ message: "Erro interno do servidor ao cadastrar o operador." });
    }
});

app.put('/api/operadores/:nome', async (req, res) => {
    const nome = req.params.nome.toUpperCase();
    try {
        const { senha, idsalas } = req.body;
        let updateData = {};
        if (senha && senha.trim() !== '') {
            updateData.senha = senha;
        }
        if (nome !== 'TECBIN') {
            if (!idsalas || idsalas.length === 0) {
                return res.status(400).json({ message: "Pelo menos uma sala de acesso é obrigatória para atualização." });
            }
            updateData.idsalas = idsalas;
        } else {
            if (!idsalas || idsalas.length === 0) {
                return res.status(400).json({ message: "O operador TECBIN deve ter acesso a pelo menos uma sala." });
            }
            updateData.idsalas = idsalas;
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "Nenhum dado para atualizar foi fornecido." });
        }
        const operadoresCollection = db.collection('operadores');
        const result = await operadoresCollection.updateOne(
            { nome: nome },
            { $set: updateData }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Operador não encontrado." });
        }
        res.status(200).json({ message: "Operador atualizado com sucesso!" });
    } catch (error) {
        console.error("Erro ao atualizar operador:", error);
        res.status(500).json({ message: "Erro interno do servidor ao atualizar a sala." });
    }
});

app.delete('/api/operadores/:nome', async (req, res) => {
    const nome = req.params.nome.toUpperCase();
    try {
        if (nome === 'TECBIN') {
            return res.status(403).json({ message: "O operador TECBIN não pode ser excluído." });
        }
        const operadoresCollection = db.collection('operadores');
        const result = await operadoresCollection.deleteOne({ nome: nome });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Operador não encontrado." });
        }
        res.status(200).json({ message: "Operador excluído com sucesso!" });
    } catch (error) {
        console.error("Erro ao excluir operador:", error);
        res.status(500).json({ message: "Erro interno do servidor ao excluir a sala." });
    }
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/api/clientes/telefone/:telefone', async (req, res) => {
    const { telefone } = req.params;
    const telefoneLimpo = telefone.replace(/\D/g, '').trim(); // Remove caracteres não numéricos
    try {
        const clientesCollection = db.collection('clientes');
        const cliente = await clientesCollection.findOne({ telefone: telefoneLimpo });
        if (cliente) {
            res.json({ encontrado: true, nick: cliente.nick, idcliente: cliente.idcliente });
        } else {
            res.json({ encontrado: false });
        }
    } catch (error) {
        console.error('Erro ao buscar cliente por telefone:', error);
        res.status(500).json({ error: 'Erro interno ao buscar cliente.' });
    }
});

app.get('/api/clientes/id/:idcliente', async (req, res) => {
    const { idcliente } = req.params;
    try {
        const clientesCollection = db.collection('clientes');
        const cliente = await clientesCollection.findOne({ idcliente: parseInt(idcliente) });
        if (cliente) {
            res.json({ encontrado: true, nick: cliente.nick, idcliente: cliente.idcliente });
        } else {
            res.json({ encontrado: false });
        }
    } catch (error) {
        console.error('Erro ao buscar cliente por id:', error);
        res.status(500).json({ error: 'Erro interno ao buscar cliente.' });
    }
});

app.get('/api/atendentes/:idSala', async (req, res) => {
    const idSala = req.params.idSala;
    try {
        if (!idSala || idSala.trim() === '') {
            return res.status(400).json({ message: "O ID da sala é obrigatório para buscar atendentes." });
        }
        
        const atendentesCollection = 'atendentes';
        const query = {
            idsala: { $regex: new RegExp(`^\\s*${idSala.trim()}\\s*$`, 'i') }
        };
        const atendentes = await db.collection(atendentesCollection).find(query).project({ apelido: 1, idatendente: 1, _id: 0 }).toArray();
        const atendentesLimpos = atendentes.map(atendente => ({
            apelido: atendente.apelido ? atendente.apelido.trim() : null,
            idatendente: atendente.idatendente ? atendente.idatendente.toString().trim() : null
        }));
        res.status(200).json(atendentesLimpos);
    } catch (error) {
        console.error("Erro ao buscar atendentes:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar atendentes." });
    }
});

app.get('/api/tabelas', async (req, res) => {
    try {
        const collectionNames = await db.listCollections().map(c => c.name).toArray();
        res.status(200).json(collectionNames);
    } catch (error) {
        console.error("Erro ao buscar a lista de tabelas: Erro", error);
        res.status(500).json({ error: "Erro ao buscar a lista de tabelas." });
    }
});

// aqui
app.delete('/api/agendamentos/cancelar', async (req, res) => {
    const { idsala, idatendente, dia_mov, hora } = req.body;

    try {
        if (!idsala || !idatendente || !dia_mov || !hora) {
            return res.status(400).json({ message: "Dados incompletos para o cancelamento." });
        }
        
        // Crie o objeto de consulta diretamente com os valores da requisição
        const query = {
            idsala: idsala.trim(),
            idatendente: parseInt(idatendente),
            dia_movimento: dia_mov.trim(), // Use a data que veio da requisição
            hora: hora.trim()
        };

        const agendamentosCollection = 'agenda';
        const result = await db.collection(agendamentosCollection).deleteOne(query);

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Agendamento não encontrado para cancelamento." });
        }

        res.status(200).json({ message: "Agendamento cancelado com sucesso." });
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        res.status(500).json({ message: "Erro interno do servidor ao cancelar o agendamento." });
    }
});

// aqui

app.delete('/api/agendamentos/cancelar/todos', async (req, res) => {
    const { cliente, telefone, idsala } = req.body;
    try {
        if (!cliente || !telefone || !idsala) {
            return res.status(400).json({ message: "Dados do cliente incompletos para o cancelamento em massa. (cliente, telefone, idsala são obrigatórios)" });
        }

        const agendamentosCollection = 'agenda';
        const query = {
            cliente: cliente.trim().toUpperCase(),
            telefone: telefone.trim(),
            idsala: idsala.trim()
        };
        const result = await db.collection(agendamentosCollection).deleteMany(query);
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Nenhum agendamento encontrado para este cliente nesta sala." });
        }
        res.status(200).json({ message: `Todos os ${result.deletedCount} agendamentos do cliente foram cancelados com sucesso na sala ${idsala}.` });
    } catch (error) {
        console.error("Erro ao cancelar agendamentos em massa:", error);
        res.status(500).json({ message: "Erro interno do servidor ao cancelar os agendamentos em massa." });
    }
});

app.post('/api/agendar', async (req, res) => {
    const { idsala, idatendente, cliente, telefone, hora, periodo, atendenteNome } = req.body;
    try {
        if (!idsala || !idatendente || !cliente || !hora || !periodo || !telefone) {
            return res.status(400).json({ message: "Dados incompletos para o agendamento." });
        }
        
        const dataAtual = new Date();
        const diaMovimento = `${String(dataAtual.getDate()).padStart(2, '0')}/${String(dataAtual.getMonth() + 1).padStart(2, '0')}/${dataAtual.getFullYear()}`;
        
        const telefoneLimpo = telefone.trim().replace(/\D/g, '');

        // Lógica de agendamento (chave)
        const ultimoAgendamento = await db.collection('agenda').findOne(
            { idsala: idsala.trim() },
            { sort: { chave: -1 } }
        );
        const proximaChave = ultimoAgendamento ? ultimoAgendamento.chave + 1 : 1;

        // --- LÓGICA PARA TABELA DE CLIENTES ---
        const clienteCollection = db.collection('clientes');
        let clienteExistente = await clienteCollection.findOne({ telefone: telefoneLimpo });
        let idCliente;

        if (clienteExistente) {
            // Cliente existe: atualizar data de acesso
            await clienteCollection.updateOne(
                { telefone: telefoneLimpo },
                { $set: { data_acesso: diaMovimento } }
            );
            idCliente = clienteExistente.idcliente;
        } else {
            // Cliente não existe: criar novo registro
            const ultimoCliente = await clienteCollection.findOne({}, { sort: { idcliente: -1 } });
            const proximoIdCliente = ultimoCliente ? ultimoCliente.idcliente + 1 : 1;
            idCliente = proximoIdCliente;

            const novoCliente = {
                idcliente: proximoIdCliente,
                nick: cliente.trim().toUpperCase(),
                telefone: telefoneLimpo,
                data_cadastro: diaMovimento,
                data_acesso: diaMovimento
            };
            await clienteCollection.insertOne(novoCliente);
        }
        // --- FIM DA LÓGICA DE CLIENTES ---
        
        const novoAgendamento = {
            chave: proximaChave,
            idsala: idsala.trim(),
            idatendente: parseInt(idatendente),
            idcliente: idCliente, // Adicionando o idcliente ao agendamento
            cliente: cliente.trim().toUpperCase(),
            telefone: telefoneLimpo,
            hora: hora.trim(),
            periodo: parseInt(periodo),
            atendente: atendenteNome ? atendenteNome.trim() : null,
            dia_movimento: diaMovimento
        };

        const result = await db.collection('agenda').insertOne(novoAgendamento);

        if (result.acknowledged) {
            res.status(201).json({ message: "Agendamento realizado com sucesso!", agendamento: novoAgendamento });
        } else {
            res.status(500).json({ message: "Falha ao inserir o agendamento." });
        }

    } catch (error) {
        console.error('Erro ao agendar:', error);
        res.status(500).json({ message: "Erro interno do servidor ao agendar." });
    }
});

app.get('/api/agendamentos/cliente', async (req, res) => {
    const { cliente, telefone, idsala } = req.query;
    try {
        const agendamentosCollection = 'agenda';
        const query = {};
        if (cliente) {
            query.cliente = cliente.trim().toUpperCase();
        }
        if (telefone) {
            query.telefone = telefone.trim();
        }
        if (idsala) {
            query.idsala = { $regex: new RegExp(`^\\s*${idsala.trim()}\\s*$`, 'i') };
        }
        const agendamentos = await db.collection(agendamentosCollection).find(query).toArray();
        res.status(200).json(agendamentos);
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        res.status(500).json({ message: "Erro ao buscar agendamentos do cliente." });
    }
});

app.get('/api/agendamentos/telefone', async (req, res) => {
    const {  telefone, idsala } = req.query;
    try {
        const agendamentosCollection = 'agenda';
        const query = {};
        if (telefone) {
            query.telefone = telefone.trim();
        }
        if (idsala) {
            query.idsala = { $regex: new RegExp(`^\\s*${idsala.trim()}\\s*$`, 'i') };
        }
        const agendamentos = await db.collection(agendamentosCollection).find(query).toArray();
        res.status(200).json(agendamentos);
    } catch (error) {
        console.error("Erro ao buscar agendamentos do cliente:", error);
        res.status(500).json({ message: "Erro ao buscar agendamentos do cliente." });
    }
});

app.get('/api/agendamentos/atendente/:idSala/:idAtendente', async (req, res) => {
     const { idSala, idAtendente } = req.params;
    try {
        const hoje = new Date();
        const diaMovimento = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
        idSala = { $regex: new RegExp(`^\\s*${idSala.trim()}\\s*$`, 'i') };

    console.log("---------------------------------------");
    console.log("Requisição para checar a agenda da atendente recebida.");
    console.log("Sala : ", idSala);
    console.log("Atendente : ",  idAtendente); 
    console.log("Data : ",  diaMovimento);    
    console.log("---------------------------------------");
        
        const horarios = await db.collection('agenda').find({
            idsala: idSala.trim(),
            idatendente: parseInt(idAtendente),
            dia_movimento: diaMovimento
        }).project({ _id: 0, hora: 1, periodo: 1 }).toArray();

        res.status(200).json({ horarios: horarios });
    } catch (error) {
        console.error("Erro ao buscar a agenda do atendente:", error);
        res.status(500).json({ message: "Erro ao buscar a agenda do atendente." });
    }
});

// Rota para obter agendamentos por atendente
app.get('/api/agenda-atendente', async (req, res) => {
    const { idsala, idatendente} = req.query;
    const idsalaLimpa = idsala ? idsala.trim() : null;
    const idatendenteInt = parseInt(idatendente);
    console.log("---------------------------------------");
    console.log("Requisição para obter agenda de atendente recebida.");
    console.log("Sala : ", idsalaLimpa);
    console.log("Atendente : ",  idatendenteInt);    
    console.log("---------------------------------------");
    if (!idsala || !idatendente) {
        return res.status(400).json({ error: 'Os parâmetros idsala e atendente_nome são obrigatórios.' });
    }

    try {
        const hoje = new Date();
        const diaMovimento = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
        
        const horarios = await db.collection('agenda').find({
            idsala: idsalaLimpa,
            idatendente: idatendenteInt
        }).project({ _id: 0, hora: 1, periodo: 1 }).toArray();

        res.status(200).json({ horarios: horarios });
    } catch (error) {
        console.error("Erro ao buscar a agenda do atendente:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar a agenda do atendente." });
    }
});

app.get('/api/clientes/telefone/:telefone', async (req, res) => {
    try {
        const telefone = req.params.telefone.trim();
        const cliente = await db.collection('clientes').findOne({ telefone });
        let ultimoAgendamento = null;
        if (cliente) {
            ultimoAgendamento = await db.collection('agenda').findOne(
                { telefone },
                { sort: { dia_movimento: -1, hora: -1 } }
            );
        }

        if (cliente) {
            res.status(200).json({
                encontrado: true,
                nick: cliente.nick,
                ultimoAcesso: cliente.data_acesso,
                ultimoAgendamento: ultimoAgendamento ? {
                    dia: ultimoAgendamento.dia_movimento,
                    hora: ultimoAgendamento.hora
                } : null
            });
        } else {
            res.status(200).json({ encontrado: false });
        }
    } catch (error) {
        console.error("Erro ao buscar cliente por telefone:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar cliente." });
    }
});
// aaaa
// =========================================================================
// ROTA QUE SERVE ARQUIVOS ESTÁTICOS - DEVE VIR SEMPRE POR ÚLTIMO
// =========================================================================
app.use(express.static(path.join(__dirname, 'public')));


// Inicia a conexão e a inicialização de coleções
async function connectAndInitialize() {
    try {
        client = await MongoClient.connect(MONGO_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
        db = client.db(DB_NAME);
        await client.db("admin").command({ ping: 1 });
        console.log("Conectado ao MongoDB com sucesso!");

        VERSION = await _getAndUpdateVersion();

        // Inicia o servidor APÓS a conexão e inicialização
        app.listen(port, '0.0.0.0', () => {
            console.log(`Backend TecBoate v${VERSION} rodando em http://0.0.0.0:${port}`);
        });

    } catch (err) {
        console.error("Erro ao conectar ao MongoDB:", err);
        process.exit(1);
    }
}

connectAndInitialize();