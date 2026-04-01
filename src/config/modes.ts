import {
  MessageSquare,
  FileText,
  Theater,
  PenTool,
  Mic,
  Briefcase,
  Image,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PracticeMode {
  id: string;
  label: string;
  description: string;
  example: string;
  colorVar: string;
  icon: LucideIcon;
  to: string;
  image?: string;
  highlighted?: boolean;
}

export const exerciseModes: readonly PracticeMode[] = [
  {
    id: 'phrases',
    label: 'Frases',
    description: 'Receba uma situação e fale a frase em inglês',
    example: 'Você quer pedir um café. Como você diria isso?',
    colorVar: 'phrases',
    icon: MessageSquare,
    to: '/exercises?mode=phrases',
    image: '/images/modes/phrases.png',
  },
  {
    id: 'texts',
    label: 'Textos',
    description: 'Leia um texto e responda perguntas sobre ele',
    example: 'Leia um artigo sobre viagens e responda 5 perguntas',
    colorVar: 'texts',
    icon: FileText,
    to: '/exercises?mode=texts',
    image: '/images/modes/texts.png',
  },
  {
    id: 'situations',
    label: 'Situações',
    description: 'Responda a um cenário real em inglês',
    example: 'Você está num restaurante. Como pede a conta?',
    colorVar: 'situations',
    icon: Theater,
    to: '/exercises?mode=situations',
    image: '/images/modes/situations.png',
  },
  {
    id: 'scripts',
    label: 'Scripts',
    description: 'Receba um contexto e escreva um texto completo',
    example: 'Escreva um email formal para um cliente',
    colorVar: 'scripts',
    icon: PenTool,
    to: '/scripts',
    image: '/images/modes/scripts.png',
  },
] as const;

export const conversationModes: readonly PracticeMode[] = [
  {
    id: 'simulation',
    label: 'Simulação ao Vivo',
    description: 'Converse em tempo real com a IA por voz',
    example: 'Simule uma conversa num café em Londres',
    colorVar: 'simulation',
    icon: Mic,
    to: '/live',
    image: '/images/modes/simulation.png',
  },
  {
    id: 'interview',
    label: 'Entrevista',
    description: 'Pratique entrevistas de emprego em inglês',
    example: 'Pratique se apresentar como faria numa entrevista real',
    colorVar: 'interview',
    icon: Briefcase,
    to: '/live?scenario=interview',
    highlighted: true,
  },
  {
    id: 'visual',
    label: 'Desafio Visual',
    description: 'Veja uma imagem e descreva o que acontece',
    example: 'Descreva a cena de uma foto de mercado',
    colorVar: 'visual',
    icon: Image,
    to: '/exercises?mode=visual',
    image: '/images/modes/visual.png',
  },
] as const;

export const allModes: readonly PracticeMode[] = [
  ...exerciseModes,
  ...conversationModes,
];
