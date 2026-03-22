
// Substitua pela sua chave real do ocr.space
// Substitua pela chave que você recebeu por e-mail (OCR.space)
const MINHA_CHAVE_GRATUITA = "K82367523888957"; 

document.getElementById('cnh_scanner').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    const status = document.getElementById('scanner_status');
    if (!file) return;

    status.innerText = "⏳ PROCESSANDO CNH... AGUARDE";
    status.className = "text-blue-600 font-bold text-[10px] animate-pulse";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("apikey", MINHA_CHAVE_GRATUITA);
    formData.append("language", "por");
    formData.append("ocrEngine", "2"); // Motor otimizado para documentos

    try {
        const response = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.OCRExitCode === 1) {
            const textoLido = data.ParsedResults[0].ParsedText;
            console.log("Texto extraído:", textoLido);
            
            processarDadosLitoral(textoLido);
            
            status.innerText = "✅ CONCLUÍDO! REVISE OS CAMPOS.";
            status.className = "text-green-600 font-bold text-[10px]";
        } else {
            status.innerText = "❌ ERRO AO LER. TIRE A FOTO MAIS PERTO.";
            status.className = "text-red-600 font-bold text-[10px]";
        }
    } catch (error) {
        status.innerText = "❌ ERRO DE CONEXÃO.";
    }
});

function processarDadosLitoral(texto) {
    const raw = texto.toUpperCase();
    // Dividimos o texto em linhas e limpamos espaços extras
    const linhas = raw.split('\n').map(l => l.trim()).filter(l => l.length > 2);

    console.log("Análise de Linhas:", linhas);

    // --- 1. CPF (11 dígitos com ou sem máscara) ---
    const cpfMatch = raw.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    if (cpfMatch) {
        const cpfLimpo = cpfMatch[0].replace(/\D/g, '');
        document.getElementById('cpf').value = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    // --- 2. NÚMERO DA CNH ---
    const cnhMatch = raw.match(/\b\d{11}\b/);
    if (cnhMatch) document.getElementById('cnh').value = cnhMatch[0];

    // --- 3. DATAS (Validade e Emissão) ---
    const todasDatas = raw.match(/\d{2}\/\d{2}\/\d{4}/g);
    if (todasDatas && todasDatas.length >= 2) {
        // Geralmente a CNH lida tem: Nascimento, Emissão e Validade.
        // A Validade é quase sempre a maior/última data.
        // A Emissão costuma ser a data entre o nascimento e a validade.
        
        // Ordenamos as datas para não ter erro
        const datasOrdenadas = todasDatas.sort((a, b) => {
            return new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'));
        });

        // Validade (A mais futura)
        const valStr = datasOrdenadas[datasOrdenadas.length - 1];
        const [vd, vm, va] = valStr.split('/');
        document.getElementById('cnh_venc').value = `${va}-${vm}-${vd}`;

        // Emissão (A data anterior à validade, mas posterior ao nascimento)
        const emiStr = datasOrdenadas[datasOrdenadas.length - 2];
        const [ed, em, ea] = emiStr.split('/');
        // Verifique se o ID do campo de emissão no seu HTML é 'cnh_emissao'
        if(document.getElementById('cnh_emissao')) {
            document.getElementById('cnh_emissao').value = `${ea}-${em}-${ed}`;
        }
    }

// --- 4. BUSCA PELA CATEGORIA (Lógica de Prioridade AB) ---
const categoriasValidas = ["ACC", "AB", "AC", "AD", "AE", "A", "B", "C", "D", "E"];
const ufs = ["SP", "RJ", "MG", "ES", "PR", "SC", "RS", "MS", "MT", "GO", "DF", "AM", "BA", "CE", "PA", "PE", "RN", "PB", "AL", "SE", "RO", "AC", "RR", "AP", "TO", "PI", "MA"];

let catFinal = "";

// 1. Procuramos todas as ocorrências de 1 ou 2 letras A-E
const todasOcorrencias = raw.match(/\b[A-E]{1,2}\b/g) || [];

// 2. Filtramos apenas o que é categoria real e não é Estado (UF)
const candidatos = todasOcorrencias.filter(c => 
    categoriasValidas.includes(c) && !ufs.includes(c)
);

if (candidatos.length > 0) {
    // REGRA DE OURO: Se houver qualquer "AB", "AC" etc. na lista, 
    // nós damos prioridade para a maior string (ex: AB ganha de A)
    const maiorCat = candidatos.sort((a, b) => b.length - a.length)[0];
    
    // Na CNH, a categoria oficial geralmente aparece por último no texto lido
    const ultimaCat = candidatos[candidatos.length - 1];

    // Se a última encontrada for apenas 1 letra (A), mas existir um AB perdido antes, 
    // ficamos com o AB porque é mais específico.
    catFinal = maiorCat.length > ultimaCat.length ? maiorCat : ultimaCat;
}

// 3. Validação Extra: Se ainda estiver vazio, busca perto da palavra "CAT"
if (!catFinal) {
    const regexCat = /(?:CAT|CATEGORIA)\s*([A-E]{1,2})/i;
    const matchManual = raw.match(regexCat);
    if (matchManual) catFinal = matchManual[1];
}

if (catFinal && document.getElementById('cnh_cat')) {
    document.getElementById('cnh_cat').value = catFinal;
}

    // --- 5. NOME DO CLIENTE ---
    const termosDoc = ["BRASIL", "REPUBLICA", "NACIONAL", "MINISTERIO", "TRANSITO", "HABILITACAO", "IDENTIDADE", "NOME", "DOC", "VALIDADE", "DATA", "EMISSÃO"];
    const linhaNome = linhas.find(l => 
        l.length > 12 && 
        !/\d/.test(l) && 
        !termosDoc.some(t => l.includes(t))
    );
    if (linhaNome) document.getElementById('cliente').value = linhaNome;
}

// A lógica de clique permanece a mesma, mas agora o mapa é mais completo
const carSvg = document.getElementById('car-svg');
const uploadInput = document.getElementById('upload-input');
const damageMarkers = document.getElementById('damage-markers');
const damageList = document.getElementById('damage-list');
const noDamageText = document.getElementById('no-damage');

let clickX = 0, clickY = 0;

carSvg.addEventListener('click', function (e) {
    const rect = carSvg.getBoundingClientRect();
    clickX = e.clientX - rect.left;
    clickY = e.clientY - rect.top;
    uploadInput.click();
});

uploadInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
        const reader = new FileReader();

        // Descobre qual parte foi clicada no SVG antes de abrir o upload
        // (Isso assume que você tem os nomes nas tags <text> do seu SVG)
        let parteDetectada = "LATERAL/OUTROS";
        if (clickY < 100) parteDetectada = "LATERAL ESQUERDA";
        else if (clickY > 250) parteDetectada = "LATERAL DIREITA";
        else if (clickX < 100) parteDetectada = "FRENTE / CAPÔ";
        else if (clickX > 400) parteDetectada = "TRASEIRA";
        else parteDetectada = "TETO / CABINE";

        reader.onload = function (event) {
            // Criar ponto vermelho... (seu código do ponto continua aqui)

            // Adicionar na lista com o atributo 'data-parte'
            const item = document.createElement('div');
            item.setAttribute('data-parte', parteDetectada); // SALVA A PARTE AQUI
            item.className = "relative border rounded bg-gray-50";
            item.innerHTML = `
                <img src="${event.target.result}" class="w-full h-16 object-cover">
                <p class="text-[7px] text-center font-bold bg-red-600 text-white">${parteDetectada}</p>
            `;
            damageList.appendChild(item);
        };
        reader.readAsDataURL(this.files[0]);
    }
});

let signaturePad;
const canvas = document.getElementById('signature-pad');
const wrapper = document.getElementById('signature-wrapper');

// 1. Função de Navegação
function nextStep(n) {
    // Esconde todas as seções
    document.querySelectorAll('.step').forEach(step => {
        step.style.display = 'none';
    });

    // Mostra a seção atual
    const currentStep = document.getElementById('step' + n);
    if (currentStep) {
        currentStep.style.display = 'block';
        window.scrollTo(0, 0);
    }

    // Se for a etapa da assinatura, preparamos o terreno
    if (n === 4) {
        // Aguardamos o navegador "desenhar" a tela antes de iniciar a assinatura
        setTimeout(() => {
            resizeCanvas();
        }, 300);
    }
}

// 2. Função que ajusta o tamanho do Canvas (O Coração do Problema)
function resizeCanvas() {
    // Pega a largura e altura reais que o seu celular está mostrando agora
    const rect = wrapper.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext("2d").scale(ratio, ratio);

    // Se o SignaturePad não existir, criamos. Se existir, apenas limpamos.
    if (!signaturePad) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
    } else {
        signaturePad.clear(); // Limpa para evitar que a assinatura fique "esticada"
    }
}

// 3. EVENTO DE SEGURANÇA: Se o usuário tocar e estiver bugado, ele ajusta
canvas.addEventListener('touchstart', function () {
    if (canvas.width === 0 || canvas.height === 0) {
        resizeCanvas();
    }
}, { passive: true });

// 4. Botão Limpar
document.getElementById('clear-signature').addEventListener('click', (e) => {
    e.preventDefault();
    if (signaturePad) signaturePad.clear();
});


async function gerarContratoFinal() {
    const { jsPDF } = window.jspdf || window.jsPDF || {};
    if (!jsPDF) return alert("Erro: Biblioteca jsPDF não carregada.");

    const btn = document.querySelector('button[onclick="gerarContratoFinal()"]');
    btn.innerText = "GERANDO PDF...";
    btn.disabled = true;

    const formatarDataBR = (id) => {
        const val = document.getElementById(id)?.value;
        if (!val) return "___/___/____";
        const partes = val.split('T');
        const [ano, mes, dia] = partes[0].split('-');
        const hora = partes[1] ? " " + partes[1].substring(0, 5) : "";
        return `${dia}/${mes}/${ano}${hora}`;
    };

    try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const getVal = (id) => document.getElementById(id)?.value?.toUpperCase() || "_________________";
        const getCheck = (id) => document.getElementById(id)?.checked ? "[X]" : "[  ]";

        // ==========================================
        // PAGINA 1: CABEÇALHO, DADOS E VISTORIA
        // ==========================================

        // Cabeçalho Vermelho
        doc.setFillColor(200, 0, 0);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("LITORAL RENT A CAR - CONTRATO DE LOCAÇÃO", 10, 13);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        let y = 30;

        // 1. DADOS DO LOCATÁRIO
        doc.setFont("helvetica", "bold");
        doc.text("1. DADOS DO LOCATÁRIO", 10, y);
        doc.line(10, y + 1, 200, y + 1);
        doc.setFont("helvetica", "normal");
        y += 8;

        // Linha 1: Nome do Cliente (Deixamos espaço livre até o final da linha para nomes longos)
        doc.text(`CLIENTE: ${getVal('cliente')}`, 10, y);

        y += 6;
        // Linha 2: CPF e TEL (Separados nas extremidades para não colidirem)
        doc.text(`CPF: ${getVal('cpf')}`, 10, y);
        doc.text(`TEL: ${getVal('tel_res')}`, 110, y);

        y += 6;
        // Linha 3: Endereço (Sozinho na linha, pois costuma ser grande)
        doc.text(`ENDEREÇO: ${getVal('end_res')}`, 10, y);

        y += 6;
        // Linha 4: Bairro e Cidade/UF
        doc.text(`BAIRRO: ${getVal('bairro_res')}`, 10, y);
        doc.text(`CIDADE/UF: ${getVal('cid_res')} / ${getVal('est_res')}`, 110, y);

        y += 6;
        // Linha 5: CNH e Vencimento
        doc.text(`CNH: ${getVal('cnh')}`, 10, y);
        doc.text(`VENCIMENTO CNH: ${formatarDataBR('cnh_venc')}`, 110, y);

        // 2. DADOS DO VEÍCULO E HOSPEDAGEM
        y += 12;
        doc.setFont("helvetica", "bold");
        doc.text("2. DADOS DO VEÍCULO E HOSPEDAGEM", 10, y);
        doc.line(10, y + 1, 200, y + 1);
        doc.setFont("helvetica", "normal");
        y += 8;
        doc.text(`MODELO: ${getVal('modelo')}`, 10, y);
        doc.text(`PLACA: ${getVal('placa')}`, 100, y);
        doc.text(`COR: ${getVal('cor')}`, 160, y);
        y += 6;
        doc.text(`SAÍDA: ${formatarDataBR('saida_dt')} | KM: ${getVal('saida_km')}`, 10, y);
        doc.text(`CHEGADA: ${formatarDataBR('chegada_dt')} | KM: ${getVal('chegada_km')}`, 105, y);
        y += 6;
        doc.text(`HOTEL: ${getVal('hotel')} | TEL: ${getVal('hotel_tel')}`, 10, y);
        doc.text(`APTO: ${getVal('hotel_apto')} | DIÁRIAS: ${getVal('hotel_diarias')}`, 130, y);

        // 3. VISTORIA E ACESSÓRIOS
        y += 12;
        doc.setFont("helvetica", "bold");
        doc.text("3. RELATÓRIO DE VISTORIA", 10, y);
        doc.line(10, y + 1, 200, y + 1);
        y += 8;
        doc.setFontSize(9);
        doc.text(`ACESSÓRIOS: ${getCheck('macaco')} MACACO | ${getCheck('estepe')} ESTEPE | ${getCheck('ferram')} FERRAM. | ${getCheck('triangulo')} TRIÂNGULO | ${getCheck('documento')} DOCUMENTO`, 10, y);

        // Mapa da Vistoria (Maior agora)
        const canvasMapa = await html2canvas(document.getElementById('map-container'));
        doc.addImage(canvasMapa.toDataURL("image/jpeg", 0.8), 'JPEG', 10, y + 5, 90, 55);

        // Galeria de Fotos (Lado do Mapa)
        const listaFotos = document.querySelectorAll("#damage-list > div");
        let xF = 110, yF = y + 5;
        listaFotos.forEach((item, i) => {
            if (i < 4) {
                doc.addImage(item.querySelector('img').src, 'JPEG', xF, yF, 40, 24);
                doc.setFontSize(7);
                doc.text(`LOCAL: ${item.getAttribute('data-parte') || "AVARIA"}`, xF, yF + 27);
                yF += 30; if (i === 1) { xF = 155; yF = y + 5; } // Coluna 2 de fotos
            }
        });

        // Rodapé página 1
        doc.setFontSize(8);
        doc.text("Página 1 de 2", 105, 285, { align: "center" });

        // ==========================================
        // PAGINA 2: TERMOS E ASSINATURAS
        // ==========================================
        doc.addPage();

        // Cabeçalho Simples na Pág 2
        doc.setFillColor(200, 0, 0);
        doc.rect(0, 0, 210, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text("TERMOS E CONDIÇÕES GERAIS - LITORAL RENT A CAR", 10, 7);

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        y = 25;
        doc.text("CLÁUSULAS CONTRATUAIS:", 10, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9); // Fonte muito mais legível agora
        y += 8;

        const termos = [
            "01. O LOCATÁRIO declara receber o veículo em perfeitas condições de uso, conservação e limpeza.",
            `02. TAXA DE LAVAGEM: Será cobrada taxa de R$ ${getVal('term_lavagem_simples')} (simples) ou R$ ${getVal('term_lavagem_tecnica')} (técnica/bancos).`,
            "03. Em caso de perda da chave do veículo será cobrado o preço da chave codificada vigente.",
            `04. Quilometragem excedente ao pacote contratado será cobrada no valor de R$ ${getVal('term_km_excedente')} por Km rodado.`,
            `05. Cada hora extra de atraso na devolução será cobrada à razão de R$ ${getVal('term_hora_extra')} por hora.`,
            "06. Condições de aluguel: ter mais de 21 anos e Carteira Nacional de Habilitação (CNH) há mais de 2 anos.",
            "07. Limite de 5 pessoas. Infrações por excesso de passageiros são de total responsabilidade do locatário.",
            `08. SEGURO: Em caso de sinistro, o locatário responde pela franquia de R$ ${getVal('term_franquia')} + B.O. oficial.`,
            "09. O locatário responde pelas diárias em que o veículo permanecer parado para conserto em oficina.",
            "10. Multas de trânsito no período são de responsabilidade do locatário, inclusive cobrança via banco/protesto.",
            `11. CAUÇÃO: O locatário deixa como garantia o valor de R$ ${getVal('term_caucao')}, devolvido na inspeção final.`,
            "12. A locadora não se responsabiliza por danos materiais ou pessoais sofridos pelo locatário durante o uso.",
            "13. O uso do cinto de segurança é obrigatório por lei. Multas por descumprimento são do locatário.",
            "14. É obrigatória a apresentação e entrega de cópias da C.N.H. e Identidade do condutor.",
            "15. Em caso de devolução antecipada do veículo, não haverá restituição de valores das diárias restantes."
        ];

        termos.forEach(t => {
            // Quebra de linha automática para termos longos
            const lines = doc.splitTextToSize(t, 185);
            doc.text(lines, 10, y);
            y += (lines.length * 5) + 2;
        });

        // ÁREA DE ASSINATURA
        y += 15;
        doc.line(15, y + 20, 90, y + 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("LOCATÁRIO", 52, y + 25, { align: "center" });
        doc.setFontSize(7);
        doc.text("(Assinatura Digital via Assinafy)", 52, y + 28, { align: "center" });

        if (signaturePad && !signaturePad.isEmpty()) {
            doc.addImage(signaturePad.toDataURL(), 'PNG', 130, y, 50, 20);
        }
        doc.line(120, y + 20, 195, y + 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("LOCADOR / LITORAL RENT A CAR", 157, y + 25, { align: "center" });

        doc.setFontSize(8);
        doc.text("Página 2 de 2", 105, 285, { align: "center" });

        // SALVAMENTO
        doc.save(`Contrato_Litoral_${getVal('placa')}.pdf`);

        setTimeout(() => {
            if (confirm("PDF de 2 páginas gerado! Deseja abrir o Assinafy?")) window.open("https://app.assinafy.com.br/", "_blank");
            const fone = getVal('tel_res').replace(/\D/g, '');
            window.open(`https://api.whatsapp.com/send?phone=55${fone}&text=Segue seu contrato completo da Litoral Rent a Car.`, '_blank');
        }, 1200);

    } catch (e) { console.error(e); alert("Erro ao gerar PDF."); }
    finally { btn.innerText = "✅ FINALIZAR E GERAR CONTRATO"; btn.disabled = false; }
}