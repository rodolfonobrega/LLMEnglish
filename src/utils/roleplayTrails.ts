import type { RoleplayTrail, RoleplayTrailStep } from '../types/scenario';

export type { RoleplayTrail, RoleplayTrailStep };

export interface ThemeMeta {
  id: string;
  label: string;
  emoji: string;
  gradient: string;
}

export const THEMES_WITH_TRAILS: ThemeMeta[] = [
  { id: 'travel', label: 'Viagem & Hotéis', emoji: '✈️', gradient: 'from-sky-400 to-blue-500' },
  { id: 'food', label: 'Comida & Restaurantes', emoji: '🍽️', gradient: 'from-emerald-400 to-teal-500' },
  { id: 'shopping', label: 'Compras', emoji: '🛍️', gradient: 'from-amber-400 to-orange-500' },
  { id: 'work', label: 'Trabalho & Negócios', emoji: '💼', gradient: 'from-violet-400 to-purple-500' },
  { id: 'health', label: 'Saúde', emoji: '🏥', gradient: 'from-rose-400 to-pink-500' },
];

const ROLEPLAY_TRAILS: Record<string, RoleplayTrail[]> = {
  travel: [
    {
      id: 'hotel-stay',
      label: 'Estadia em Hotel',
      description: 'Da reserva ao check-out — uma experiência completa de hotel.',
      steps: [
        { id: 'book-hotel', label: 'Reservar Hotel', descriptionPt: 'Reservar um quarto de hotel por telefone ou pessoalmente. Escolher datas, tipo de quarto e pedidos especiais.', scenarioContext: 'Booking a hotel room over the phone or in person. Choose dates, room type, and special requests.' },
        { id: 'check-in', label: 'Fazer Check-In', descriptionPt: 'Chegar na recepção do hotel para fazer check-in. Apresentar reserva, pegar a chave e perguntar sobre comodidades.', scenarioContext: 'Arriving at the hotel front desk to check in. Presenting reservation, getting room key, asking about amenities.' },
        { id: 'room-service', label: 'Serviço de Quarto', descriptionPt: 'Ligar para o serviço de quarto para pedir comida ou bebida. Fazer pedido, combinar horário de entrega.', scenarioContext: 'Calling room service to order food or drinks. Placing order, arranging delivery time, asking about special dietary needs.' },
        { id: 'complain-issue', label: 'Reclamar de Problema', descriptionPt: 'Reclamar com a equipe do hotel sobre um problema — vizinhos barulhentos, ar-condicionado quebrado, quarto errado ou erro na conta.', scenarioContext: 'Complaining to hotel staff about a problem — noisy neighbors, broken AC, wrong room type, or billing error.' },
        { id: 'check-out', label: 'Fazer Check-Out', descriptionPt: 'Fazer check-out na recepção. Acertar a conta, pedir nota fiscal, solicitar late checkout ou guardar bagagem.', scenarioContext: 'Checking out at the front desk. Settling the bill, asking for invoice, requesting late checkout or storing luggage.' },
      ],
    },
    {
      id: 'airport-adventure',
      label: 'Aventura no Aeroporto',
      description: 'Navegue toda a jornada do aeroporto, do check-in à chegada.',
      steps: [
        { id: 'check-in-desk', label: 'Fazer Check-In', descriptionPt: 'No balcão de check-in da companhia aérea. Apresentar passaporte, escolher assento, despachar bagagem.', scenarioContext: 'At the airline check-in counter. Presenting passport, choosing seat, checking baggage, asking about upgrades.' },
        { id: 'security', label: 'Segurança', descriptionPt: 'Passando pela segurança do aeroporto. Responder perguntas sobre líquidos, eletrônicos ou revista adicional.', scenarioContext: 'Going through airport security. Answering questions about liquids, electronics, or being selected for additional screening.' },
        { id: 'boarding', label: 'Embarque', descriptionPt: 'No portão de embarque. Perguntar sobre grupo de embarque, status do voo ou solicitar assistência.', scenarioContext: 'At the boarding gate. Asking about boarding group, flight status, or requesting assistance.' },
        { id: 'in-flight', label: 'Durante o Voo', descriptionPt: 'Durante o voo. Pedir bebidas ou lanches ao comissário, perguntar hora de pouso, relatar desconforto.', scenarioContext: 'During the flight. Ordering drinks or snacks from flight attendant, asking about landing time, reporting discomfort.' },
        { id: 'arrival', label: 'Chegada', descriptionPt: 'Após o pouso. Pedir informações sobre esteira de bagagem, alfândega ou transporte terrestre.', scenarioContext: 'After landing. Asking for directions to baggage claim, customs, or ground transportation.' },
      ],
    },
  ],
  food: [
    {
      id: 'restaurant-experience',
      label: 'Experiência em Restaurante',
      description: 'Uma experiência gastronômica completa, da reserva ao pagamento.',
      steps: [
        { id: 'reserve-table', label: 'Reservar Mesa', descriptionPt: 'Ligar ou ir ao restaurante para fazer uma reserva. Escolher data, horário, número de pessoas e pedidos especiais.', scenarioContext: 'Calling or visiting a restaurant to make a reservation. Choosing date, time, party size, and special requests.' },
        { id: 'arrive-seated', label: 'Chegar e Ser Sentado', descriptionPt: 'Chegar ao restaurante e ser levado à mesa. Pedir outra mesa, cadeirão infantil ou acesso para cadeirante.', scenarioContext: 'Arriving at the restaurant and being shown to your table. Asking for a different table, high chair, or wheelchair access.' },
        { id: 'order-food', label: 'Pedir Comida', descriptionPt: 'Fazer o pedido com o garçom. Perguntar sobre o cardápio, escolher pratos, especificar o ponto da carne.', scenarioContext: 'Ordering food from the waiter. Asking about the menu, choosing dishes, specifying how you want it cooked.' },
        { id: 'ask-about-menu', label: 'Perguntar Sobre o Cardápio', descriptionPt: 'Fazer perguntas detalhadas sobre o cardápio — ingredientes, alérgenos, recomendações, harmonização de vinhos.', scenarioContext: 'Asking the waiter detailed questions about the menu — ingredients, allergens, recommendations, wine pairing.' },
        { id: 'pay-bill', label: 'Pagar a Conta', descriptionPt: 'Pedir a conta e pagar. Dividir a conta, dar gorjeta, usar cartão estrangeiro ou contestar uma cobrança.', scenarioContext: 'Asking for the bill and paying. Splitting the check, tipping, using a foreign card, or disputing a charge.' },
      ],
    },
    {
      id: 'street-food-tour',
      label: 'Tour de Comida de Rua',
      description: 'Explore a comida de rua local e negocie como um profissional.',
      steps: [
        { id: 'find-stall', label: 'Encontrar uma Barraca', descriptionPt: 'Se aproximar de uma barraca de comida de rua. Perguntar o que vendem, o que é popular ou se têm recomendações.', scenarioContext: 'Approaching a street food stall. Asking what they sell, what is popular, or if they have recommendations.' },
        { id: 'ask-local-dishes', label: 'Perguntar Sobre Pratos Locais', descriptionPt: 'Perguntar ao vendedor sobre pratos tradicionais ou locais. Ingredientes, como é feito, nível de tempero.', scenarioContext: 'Asking the vendor about traditional or local dishes. What ingredients, how it is made, level of spice.' },
        { id: 'order-negotiate', label: 'Pedir e Negociar', descriptionPt: 'Pedir comida e negociar o preço. Pedir desconto, combo ou porção menor.', scenarioContext: 'Ordering food and negotiating the price. Asking for a discount, combo deal, or smaller portion.' },
        { id: 'try-react', label: 'Provar e Reagir', descriptionPt: 'Provar a comida e reagir — pedir mais molho, dizer que está muito apimentado, elogiar o cozinheiro ou pedir outro prato.', scenarioContext: 'Trying the food and reacting — asking for more sauce, saying it is too spicy, complimenting the chef, or asking for a different dish.' },
      ],
    },
  ],
  shopping: [
    {
      id: 'return-exchange',
      label: 'Devolução e Troca',
      description: 'Lide com devoluções e trocas com confiança.',
      steps: [
        { id: 'find-customer-service', label: 'Encontrar Atendimento', descriptionPt: 'Procurar o balcão de atendimento ao cliente ou devoluções em uma loja. Perguntar onde fica.', scenarioContext: 'Looking for customer service or returns desk in a store. Asking staff where to go for returns.' },
        { id: 'explain-problem', label: 'Explicar o Problema', descriptionPt: 'Explicar por que quer devolver ou trocar um item. Produto com defeito, tamanho errado, mudou de ideia.', scenarioContext: 'Explaining why you want to return or exchange an item. Faulty product, wrong size, changed mind, gift receipt.' },
        { id: 'negotiate', label: 'Negociar', descriptionPt: 'Negociar com o atendimento — crédito na loja vs reembolso, trocar por outro item, reembolso parcial.', scenarioContext: 'Negotiating with customer service — store credit vs refund, exchange for different item, partial refund, or upgrade.' },
        { id: 'get-resolution', label: 'Resolver a Situação', descriptionPt: 'Finalizar a devolução ou troca. Assinar formulários, receber reembolso, escolher substituto ou escalar para o gerente.', scenarioContext: 'Finalizing the return or exchange. Signing forms, getting refund, choosing replacement, or escalating to manager.' },
      ],
    },
    {
      id: 'bargain-hunter',
      label: 'Caçador de Ofertas',
      description: 'Navegue, pechinche e consiga o melhor preço.',
      steps: [
        { id: 'browse-items', label: 'Ver os Produtos', descriptionPt: 'Olhar produtos em um mercado ou loja. Pedir para ver itens, experimentar, comparar opções.', scenarioContext: 'Browsing items at a market or store. Asking to see items, trying things on, comparing options.' },
        { id: 'ask-prices', label: 'Perguntar Preços', descriptionPt: 'Perguntar sobre preços. Tem desconto? Preço por quantidade? Desconto no dinheiro?', scenarioContext: 'Asking about prices. Is there a discount? Bulk pricing? Cash discount? Price for different size?' },
        { id: 'negotiate-discount', label: 'Negociar Desconto', descriptionPt: 'Negociar por um preço menor. Fazer uma oferta, juntar itens ou pedir uma condição melhor.', scenarioContext: 'Negotiating for a lower price. Making an offer, bundling items, or asking for a better deal.' },
        { id: 'make-purchase', label: 'Fazer a Compra', descriptionPt: 'Finalizar a compra. Pagar, pedir nota fiscal, embalagem ou entrega.', scenarioContext: 'Making the final purchase. Paying, asking for receipt, packaging, or delivery.' },
      ],
    },
  ],
  work: [
    {
      id: 'job-interview',
      label: 'Entrevista de Emprego',
      description: 'Navegue uma entrevista completa, da saudação ao salário.',
      steps: [
        { id: 'greet-interviewer', label: 'Cumprimentar o Entrevistador', descriptionPt: 'Cumprimentar o entrevistador no início. Conversa informal, aperto de mão, causar boa primeira impressão.', scenarioContext: 'Greeting the interviewer at the start of a job interview. Small talk, handshake, making a good first impression.' },
        { id: 'answer-about-yourself', label: 'Falar Sobre Você', descriptionPt: 'Responder "Fale sobre você" ou perguntas semelhantes. Apresentar sua formação, experiência e motivação.', scenarioContext: 'Answering Tell me about yourself or similar questions. Introducing your background, experience, and motivation.' },
        { id: 'technical-questions', label: 'Perguntas Técnicas', descriptionPt: 'Responder perguntas técnicas ou de competência. Explicar projetos, resolver problemas ou discutir habilidades.', scenarioContext: 'Answering technical or competency-based interview questions. Explaining projects, solving problems, or discussing skills.' },
        { id: 'ask-about-company', label: 'Perguntar Sobre a Empresa', descriptionPt: 'Fazer perguntas ao entrevistador sobre a empresa. Cultura, equipe, crescimento, dia a dia ou próximos passos.', scenarioContext: 'Asking the interviewer questions about the company. Culture, team, growth, day-to-day, or next steps.' },
        { id: 'salary-negotiation', label: 'Negociação Salarial', descriptionPt: 'Discutir salário e remuneração. Falar suas expectativas, negociar oferta ou discutir benefícios.', scenarioContext: 'Discussing salary and compensation. Stating expectations, negotiating offer, or discussing benefits.' },
      ],
    },
    {
      id: 'first-day',
      label: 'Primeiro Dia',
      description: 'O primeiro dia de um novato — conheça a equipe e se situe.',
      steps: [
        { id: 'meet-colleagues', label: 'Conhecer os Colegas', descriptionPt: 'Conhecer os colegas pela primeira vez. Apresentações, conversa informal, aprender nomes e funções.', scenarioContext: 'Meeting colleagues for the first time on your first day. Introductions, small talk, learning names and roles.' },
        { id: 'office-tour', label: 'Tour pelo Escritório', descriptionPt: 'Fazer um tour pelo escritório. Encontrar sua mesa, banheiro, cozinha, salas de reunião e perguntar onde ficam as coisas.', scenarioContext: 'Getting an office tour. Finding your desk, bathroom, kitchen, meeting rooms, and asking where things are.' },
        { id: 'first-meeting', label: 'Primeira Reunião', descriptionPt: 'Participar da sua primeira reunião de equipe. Se apresentar, entender a pauta ou fazer perguntas.', scenarioContext: 'Sitting in your first team meeting. Introducing yourself, understanding the agenda, or asking questions.' },
        { id: 'lunch-with-team', label: 'Almoço com a Equipe', descriptionPt: 'Ir almoçar com a equipe nova. Pedir comida, fazer conversa informal, conhecer a cultura da equipe.', scenarioContext: 'Going to lunch with your new team. Ordering food, making small talk, learning about the team culture.' },
      ],
    },
  ],
  health: [
    {
      id: 'doctor-visit',
      label: 'Consulta Médica',
      description: 'Da recepção à farmácia — uma consulta médica completa.',
      steps: [
        { id: 'check-in-reception', label: 'Recepção', descriptionPt: 'Fazer check-in na recepção do consultório ou clínica. Apresentar convênio, preencher formulários, perguntar sobre espera.', scenarioContext: 'Checking in at the doctor\'s office or clinic reception. Providing insurance, filling forms, asking about wait time.' },
        { id: 'describe-symptoms', label: 'Descrever Sintomas', descriptionPt: 'Descrever seus sintomas para o enfermeiro ou médico. Explicar o que dói, há quanto tempo, gravidade e detalhes relevantes.', scenarioContext: 'Describing your symptoms to a nurse or doctor. Explaining what hurts, how long, severity, and any other relevant details.' },
        { id: 'doctor-examination', label: 'Exame Médico', descriptionPt: 'Durante o exame do médico. Responder perguntas, perguntar o que ele está fazendo, expressar preocupação ou dor.', scenarioContext: 'During the doctor\'s examination. Answering questions, asking what they are doing, expressing concern or pain.' },
        { id: 'discuss-treatment', label: 'Discutir Tratamento', descriptionPt: 'Discutir opções de tratamento com o médico. Perguntar sobre medicação, efeitos colaterais, alternativas ou retorno.', scenarioContext: 'Discussing treatment options with the doctor. Asking about medication, side effects, alternatives, or follow-up.' },
        { id: 'pharmacy-pickup', label: 'Retirar na Farmácia', descriptionPt: 'Retirar receita na farmácia. Perguntar sobre dosagem, instruções, opções genéricas ou convênio.', scenarioContext: 'Picking up prescription at the pharmacy. Asking about dosage, instructions, generic options, or insurance.' },
      ],
    },
  ],
};

export function getTrailsForTheme(themeId: string): RoleplayTrail[] {
  return ROLEPLAY_TRAILS[themeId] ?? [];
}
