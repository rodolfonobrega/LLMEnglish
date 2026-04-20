import { PhraseExercise } from '../exercises/PhraseExercise';
import { TextExercise } from '../exercises/TextExercise';
import { RoleplayExercise } from '../exercises/RoleplayExercise';

export type ExerciseType = 'phrase' | 'text' | 'roleplay';

interface ExerciseModeProps {
  initialType?: ExerciseType;
}

export function ExerciseMode({ initialType = 'phrase' }: ExerciseModeProps) {
  switch (initialType) {
    case 'phrase':
      return <PhraseExercise />;
    case 'text':
      return <TextExercise />;
    case 'roleplay':
      return <RoleplayExercise />;
  }
}
