import {
  MessageSquare,
  FileText,
  Theater,
  PenTool,
  Mic,
  Image,
  Route,
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
    description: 'Receba um texto em português e fale em inglês com naturalidade',
    example: 'Leia um parágrafo sobre viagens e fale em inglês',
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
    description: 'Gere diálogos para praticar como um ator, lendo e atuando as falas',
    example: 'Atue uma entrevista técnica com um recrutador do Google',
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
    description: 'Converse em tempo real com a IA por voz ou pratique entrevistas',
    example: 'Simule uma conversa num café em Londres',
    colorVar: 'simulation',
    icon: Mic,
    to: '/live',
    image: '/images/modes/simulation.png',
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

export const trailsMode: PracticeMode = {
  id: 'trails',
  label: 'Trilhas',
  description: 'Siga trilhas guiadas por situações da vida real',
  example: 'Complete uma trilha de viagem: aeroporto, hotel, restaurante',
  colorVar: 'trails',
  icon: Route,
  to: '/paths',
  image: '/images/modes/trails.png',
};

export const allModes: readonly PracticeMode[] = [
  ...exerciseModes,
  ...conversationModes,
  trailsMode,
];
