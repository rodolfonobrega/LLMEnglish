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
  highlighted?: boolean;
}

export const exerciseModes: readonly PracticeMode[] = [
  {
    id: 'phrases',
    label: 'Frases',
    description: 'Traduza e pratique frases do dia a dia',
    example: "Traduza \"I'd like to order coffee, please\"",
    colorVar: 'phrases',
    icon: MessageSquare,
    to: '/exercises?mode=phrases',
  },
  {
    id: 'texts',
    label: 'Textos',
    description: 'Leia um texto e responda perguntas sobre ele',
    example: 'Leia um artigo sobre viagens e responda 5 perguntas',
    colorVar: 'texts',
    icon: FileText,
    to: '/exercises?mode=texts',
  },
  {
    id: 'situations',
    label: 'Situações',
    description: 'Responda a um cenário real em inglês',
    example: 'Você está num restaurante. Como pede a conta?',
    colorVar: 'situations',
    icon: Theater,
    to: '/exercises?mode=situations',
  },
  {
    id: 'scripts',
    label: 'Scripts',
    description: 'Receba um contexto e escreva um texto completo',
    example: 'Escreva um email formal para um cliente',
    colorVar: 'scripts',
    icon: PenTool,
    to: '/scripts',
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
  },
  {
    id: 'interview',
    label: 'Entrevista',
    description: 'Pratique entrevistas de emprego em inglês',
    example: 'Responda "Tell me about yourself" como num interview real',
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
  },
] as const;

export const allModes: readonly PracticeMode[] = [
  ...exerciseModes,
  ...conversationModes,
];
