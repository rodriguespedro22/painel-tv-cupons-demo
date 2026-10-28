/* Novidades do painel · aparece na aba "Novidades" da bolinha de ajuda.
   Para cada publicação, acrescente um item NO TOPO da lista:
     versao  — mesmo número do CHANGELOG.md
     quando  — data e hora da publicação (horário de Brasília), "AAAA-MM-DDTHH:MM"; só a data, se a hora não importar
     itens   — frases curtas, em linguagem simples, do ponto de vista de quem usa o painel (pode usar <b>negrito</b>)
   Quando a versão do topo muda, a bolinha mostra um ponto laranja até a pessoa abrir a aba. */
/* exported NOVIDADES, AJUDA_CONTATO */

const AJUDA_CONTATO = "suporte@exemplo.com.br";

const NOVIDADES = [
  {
    versao: "9.7",
    quando: "2026-10-27T10:00",
    itens: [
      "No <b>Ranking de cupons</b>, agora dá para <b>buscar um cupom</b> pelo nome e <b>filtrar por grupo</b> (CRM, Influenciador, Rádio, Filial…), com a quantidade de cupons em cada grupo.",
      "A lista do ranking passou a <b>rolar</b>: dá para ver todos os cupons, não só os primeiros. A posição de cada cupom continua sendo a do ranking geral.",
      "A busca, os grupos e a rolagem aparecem para quem entra com login e no modo análise. A <b>TV continua com a tela de sempre</b>.",
    ],
  },
  {
    versao: "9.6",
    quando: "2026-10-23T17:30",
    itens: [
      "Para administradores: botão <b>Sincronizar tudo</b>, que confere a planilha inteira e mostra, campo a campo, o que mudou em cada cupom.",
    ],
  },
  {
    versao: "9.5",
    quando: "2026-10-22T14:00",
    itens: [
      "No <b>Glossário</b>, os cupons que ainda não tiveram venda aparecem com a etiqueta <b>sem vendas até agora</b>.",
      "Para administradores: nova <b>Conferência dos cupons</b>, com os códigos vendidos que não estão na planilha (e com qual cupom parecem) e os cupons da planilha sem nenhuma venda.",
      "A sincronização da planilha agora mostra também <b>quais cupons foram alterados</b>.",
    ],
  },
  {
    versao: "9.4",
    quando: "2026-10-16T08:42",
    itens: [
      "Filtro de <b>cupons ativos ou encerrados</b> no Glossário.",
      "O mesmo filtro no botão <b>Cupons</b> da barra: o painel inteiro passa a mostrar só os ativos ou só os encerrados.",
    ],
  },
  {
    versao: "9.3",
    quando: "2026-10-15T17:06",
    itens: [
      "Bolinha ao lado de cada cupom: <b>verde</b> = ativo, <b>cinza</b> = encerrado (pelas datas de validade da planilha).",
      "A <b>conversão</b> agora é calculada pela <b>base de clientes</b> de cada cupom (usados ÷ clientes que receberam).",
      "Cupons sem base de clientes na planilha ficam com a conversão em branco.",
      "Na tela <b>Rádio/Influenciadores</b>, a conversão fica oculta por enquanto; os cupons aparecem pelos mais usados.",
    ],
  },
  {
    versao: "9.2",
    quando: "2026-10-15T14:30",
    itens: [
      "Todos podem escolher <b>datas</b> no filtro, no computador e no celular.",
      "O <b>Glossário</b> agora abre pelo botão no topo da tela.",
      "O grupo Institucional passa a se chamar <b>CRM</b>.",
      "Tabelas da tela <b>1ª compra/Recuperação</b> com as colunas alinhadas aos títulos.",
      "Nova bolinha de <b>ajuda</b>, com contato e as novidades de cada versão.",
    ],
  },
  {
    versao: "9.1",
    quando: "2026-10-15T10:22",
    itens: ["Nova tela <b>Glossário</b>: as regras de cada cupom em um só lugar."],
  },
  {
    versao: "9",
    quando: "2026-10-14",
    itens: [
      "Pedido de acesso direto na tela de login.",
      "Filtro por <b>departamento e setor</b>.",
      "Tela <b>1ª compra e Recuperação</b> de clientes.",
    ],
  },
  { versao: "6", quando: "2026-10-06", itens: ["Login individual com aplicativo autenticador."] },
  { versao: "5", quando: "2026-10-05", itens: ["Faixa com os 4 números principais da campanha."] },
  { versao: "4", quando: "2026-10-03", itens: ["Ranking de <b>filiais</b>."] },
  { versao: "3", quando: "2026-10-02", itens: ["Números atualizados automaticamente ao longo do dia."] },
];
