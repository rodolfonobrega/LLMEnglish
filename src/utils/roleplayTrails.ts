import type { RoleplayTrail, RoleplayTrailStep } from '../types/scenario';

export type { RoleplayTrail, RoleplayTrailStep };

const ROLEPLAY_TRAILS: Record<string, RoleplayTrail[]> = {
  travel: [
    {
      id: 'hotel-stay',
      label: 'Hotel Stay',
      description: 'From booking to check-out — a full hotel experience.',
      steps: [
        { id: 'book-hotel', label: 'Book Hotel', scenarioContext: 'Booking a hotel room over the phone or in person. Choose dates, room type, and special requests.' },
        { id: 'check-in', label: 'Check In', scenarioContext: 'Arriving at the hotel front desk to check in. Presenting reservation, getting room key, asking about amenities.' },
        { id: 'room-service', label: 'Room Service', scenarioContext: 'Calling room service to order food or drinks. Placing order, arranging delivery time, asking about special dietary needs.' },
        { id: 'complain-issue', label: 'Complain About Issue', scenarioContext: 'Complaining to hotel staff about a problem — noisy neighbors, broken AC, wrong room type, or billing error.' },
        { id: 'check-out', label: 'Check Out', scenarioContext: 'Checking out at the front desk. Settling the bill, asking for invoice, requesting late checkout or storing luggage.' },
      ],
    },
    {
      id: 'airport-adventure',
      label: 'Airport Adventure',
      description: 'Navigate the full airport journey from check-in to arrival.',
      steps: [
        { id: 'check-in-desk', label: 'Check In', scenarioContext: 'At the airline check-in counter. Presenting passport, choosing seat, checking baggage, asking about upgrades.' },
        { id: 'security', label: 'Security', scenarioContext: 'Going through airport security. Answering questions about liquids, electronics, or being selected for additional screening.' },
        { id: 'boarding', label: 'Boarding', scenarioContext: 'At the boarding gate. Asking about boarding group, flight status, or requesting assistance.' },
        { id: 'in-flight', label: 'In-Flight', scenarioContext: 'During the flight. Ordering drinks or snacks from flight attendant, asking about landing time, reporting discomfort.' },
        { id: 'arrival', label: 'Arrival', scenarioContext: 'After landing. Asking for directions to baggage claim, customs, or ground transportation.' },
      ],
    },
  ],
  food: [
    {
      id: 'restaurant-experience',
      label: 'Restaurant Experience',
      description: 'A complete dining experience from reservation to paying the bill.',
      steps: [
        { id: 'reserve-table', label: 'Reserve Table', scenarioContext: 'Calling or visiting a restaurant to make a reservation. Choosing date, time, party size, and special requests.' },
        { id: 'arrive-seated', label: 'Arrive & Be Seated', scenarioContext: 'Arriving at the restaurant and being shown to your table. Asking for a different table, high chair, or wheelchair access.' },
        { id: 'order-food', label: 'Order Food', scenarioContext: 'Ordering food from the waiter. Asking about the menu, choosing dishes, specifying how you want it cooked.' },
        { id: 'ask-about-menu', label: 'Ask About Menu', scenarioContext: 'Asking the waiter detailed questions about the menu — ingredients, allergens, recommendations, wine pairing.' },
        { id: 'pay-bill', label: 'Pay Bill', scenarioContext: 'Asking for the bill and paying. Splitting the check, tipping, using a foreign card, or disputing a charge.' },
      ],
    },
    {
      id: 'street-food-tour',
      label: 'Street Food Tour',
      description: 'Explore local street food and negotiate like a pro.',
      steps: [
        { id: 'find-stall', label: 'Find a Food Stall', scenarioContext: 'Approaching a street food stall. Asking what they sell, what is popular, or if they have recommendations.' },
        { id: 'ask-local-dishes', label: 'Ask About Local Dishes', scenarioContext: 'Asking the vendor about traditional or local dishes. What ingredients, how it is made, level of spice.' },
        { id: 'order-negotiate', label: 'Order & Negotiate', scenarioContext: 'Ordering food and negotiating the price. Asking for a discount, combo deal, or smaller portion.' },
        { id: 'try-react', label: 'Try the Food & React', scenarioContext: 'Trying the food and reacting — asking for more sauce, saying it is too spicy, complimenting the chef, or asking for a different dish.' },
      ],
    },
  ],
  shopping: [
    {
      id: 'return-exchange',
      label: 'Return & Exchange',
      description: 'Handle returns and exchanges like a confident shopper.',
      steps: [
        { id: 'find-customer-service', label: 'Find Customer Service', scenarioContext: 'Looking for customer service or returns desk in a store. Asking staff where to go for returns.' },
        { id: 'explain-problem', label: 'Explain the Problem', scenarioContext: 'Explaining why you want to return or exchange an item. Faulty product, wrong size, changed mind, gift receipt.' },
        { id: 'negotiate', label: 'Negotiate', scenarioContext: 'Negotiating with customer service — store credit vs refund, exchange for different item, partial refund, or upgrade.' },
        { id: 'get-resolution', label: 'Get Resolution', scenarioContext: 'Finalizing the return or exchange. Signing forms, getting refund, choosing replacement, or escalating to manager.' },
      ],
    },
    {
      id: 'bargain-hunter',
      label: 'Bargain Hunter',
      description: 'Browse, haggle, and land the best deal.',
      steps: [
        { id: 'browse-items', label: 'Browse Items', scenarioContext: 'Browsing items at a market or store. Asking to see items, trying things on, comparing options.' },
        { id: 'ask-prices', label: 'Ask Prices', scenarioContext: 'Asking about prices. Is there a discount? Bulk pricing? Cash discount? Price for different size?' },
        { id: 'negotiate-discount', label: 'Negotiate Discount', scenarioContext: 'Negotiating for a lower price. Making an offer, bundling items, or asking for a better deal.' },
        { id: 'make-purchase', label: 'Make Purchase', scenarioContext: 'Making the final purchase. Paying, asking for receipt, packaging, or delivery.' },
      ],
    },
  ],
  work: [
    {
      id: 'job-interview',
      label: 'Job Interview',
      description: 'Navigate a full job interview from greeting to salary.',
      steps: [
        { id: 'greet-interviewer', label: 'Greet Interviewer', scenarioContext: 'Greeting the interviewer at the start of a job interview. Small talk, handshake, making a good first impression.' },
        { id: 'answer-about-yourself', label: 'Answer About Yourself', scenarioContext: 'Answering Tell me about yourself or similar questions. Introducing your background, experience, and motivation.' },
        { id: 'technical-questions', label: 'Technical Questions', scenarioContext: 'Answering technical or competency-based interview questions. Explaining projects, solving problems, or discussing skills.' },
        { id: 'ask-about-company', label: 'Ask About Company', scenarioContext: 'Asking the interviewer questions about the company. Culture, team, growth, day-to-day, or next steps.' },
        { id: 'salary-negotiation', label: 'Salary Negotiation', scenarioContext: 'Discussing salary and compensation. Stating expectations, negotiating offer, or discussing benefits.' },
      ],
    },
    {
      id: 'first-day',
      label: 'First Day',
      description: 'A newcomer\'s first day — meet the team and get oriented.',
      steps: [
        { id: 'meet-colleagues', label: 'Meet Colleagues', scenarioContext: 'Meeting colleagues for the first time on your first day. Introductions, small talk, learning names and roles.' },
        { id: 'office-tour', label: 'Office Tour', scenarioContext: 'Getting an office tour. Finding your desk, bathroom, kitchen, meeting rooms, and asking where things are.' },
        { id: 'first-meeting', label: 'First Meeting', scenarioContext: 'Sitting in your first team meeting. Introducing yourself, understanding the agenda, or asking questions.' },
        { id: 'lunch-with-team', label: 'Lunch With Team', scenarioContext: 'Going to lunch with your new team. Ordering food, making small talk, learning about the team culture.' },
      ],
    },
  ],
  health: [
    {
      id: 'doctor-visit',
      label: 'Doctor Visit',
      description: 'From check-in to pharmacy — a complete doctor visit.',
      steps: [
        { id: 'check-in-reception', label: 'Check In at Reception', scenarioContext: 'Checking in at the doctor\'s office or clinic reception. Providing insurance, filling forms, asking about wait time.' },
        { id: 'describe-symptoms', label: 'Describe Symptoms', scenarioContext: 'Describing your symptoms to a nurse or doctor. Explaining what hurts, how long, severity, and any other relevant details.' },
        { id: 'doctor-examination', label: 'Doctor Examination', scenarioContext: 'During the doctor\'s examination. Answering questions, asking what they are doing, expressing concern or pain.' },
        { id: 'discuss-treatment', label: 'Discuss Treatment', scenarioContext: 'Discussing treatment options with the doctor. Asking about medication, side effects, alternatives, or follow-up.' },
        { id: 'pharmacy-pickup', label: 'Pharmacy Pickup', scenarioContext: 'Picking up prescription at the pharmacy. Asking about dosage, instructions, generic options, or insurance.' },
      ],
    },
  ],
};

export function getTrailsForTheme(themeId: string): RoleplayTrail[] {
  return ROLEPLAY_TRAILS[themeId] ?? [];
}
