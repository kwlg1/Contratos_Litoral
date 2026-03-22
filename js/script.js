document.getElementById('cnh_scanner').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const status = document.getElementById('scanner_status');
    if (!file) return;

    status.innerText = "LENDO DADOS DA CNH... AGUARDE.";
    status.classList.add("text-blue-600");

    Tesseract.recognize(
        file,
        'por', // Idioma Português
        { logger: m => console.log(m) }
    ).then(({ data: { text } }) => {
        // 1. Limpeza: Transforma tudo em Maiúsculas e remove espaços extras
        const linhas = text.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 3);

        // 2. Lista de palavras que DEVEMOS IGNORAR (termos fixos da CNH)
        const ignorar = ["NOME", "DOC", "IDENTIDADE", "BRASIL", "REPUBLICA", "CARTEIRA", "NACIONAL", "HABILITACAO", "FILIACAO", "ACC", "ORGAO", "EMISSOR", "LOCAL", "DATA"];

        // --- BUSCA PELO CPF ---
        const cpfMatch = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
        if (cpfMatch) document.getElementById('cpf').value = cpfMatch[0];

        // --- BUSCA PELA CNH (11 DÍGITOS) ---
        const cnhMatch = text.match(/\d{11}/);
        if (cnhMatch) document.getElementById('cnh').value = cnhMatch[0];

        // --- BUSCA PELO NOME (A PARTE DIFÍCIL) ---
        // Vamos procurar a primeira linha que NÃO tenha números e NÃO esteja na lista de ignorar
        const nomeReal = linhas.find(linha => {
            const temNumero = /\d/.test(linha);
            const ehTermoFixo = ignorar.some(termo => linha.includes(termo));
            return !temNumero && !ehTermoFixo && linha.length > 8;
        });

        if (nomeReal) {
            // Se o nome vier com "NOME:" no início, a gente remove
            document.getElementById('cliente').value = nomeReal.replace("NOME:", "").trim();
        }

        // --- BUSCA PELA VALIDADE ---
        const dataMatch = text.match(/\d{2}\/\d{2}\/\d{4}/g);
        // Geralmente a maior data na CNH é a de validade
        if (dataMatch && dataMatch.length > 0) {
            // Converte DD/MM/AAAA para o formato do input date (AAAA-MM-DD)
            const partes = dataMatch[dataMatch.length - 1].split('/');
            document.getElementById('cnh_venc').value = `${partes[2]}-${partes[1]}-${partes[0]}`;
        }

        status.innerText = "LEITURA CONCLUÍDA! REVISE OS CAMPOS.";
        status.classList.replace("text-blue-600", "text-green-600");
    })
});


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