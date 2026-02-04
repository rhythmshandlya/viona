import { AbsoluteFill, Sequence } from 'remotion';
import IntroProblem from './scenes/intro_problem';
import Constraints from './scenes/constraints';
import TheChallenge from './scenes/the_challenge';
import TheSolutionLogic from './scenes/the_solution_logic';
import TheMechanism from './scenes/the_mechanism';
import MathematicalProof from './scenes/mathematical_proof';
import ThePuzzle from './scenes/the_puzzle';
import Outro from './scenes/outro';

// Visual Concept: A linear stream of data packets flowing into a single memory slot (the reservoir), where a probability counter determines if the incoming packet replaces the current occupant.
export default function Main() {
  return (
    <AbsoluteFill style={{ background: '#0F172A' }}>
      <Sequence from={0} durationInFrames={300} name="intro_problem">
        <IntroProblem />
      </Sequence>
      <Sequence from={300} durationInFrames={240} name="constraints">
        <Constraints />
      </Sequence>
      <Sequence from={540} durationInFrames={270} name="the_challenge">
        <TheChallenge />
      </Sequence>
      <Sequence from={810} durationInFrames={210} name="the_solution_logic">
        <TheSolutionLogic />
      </Sequence>
      <Sequence from={1020} durationInFrames={270} name="the_mechanism">
        <TheMechanism />
      </Sequence>
      <Sequence from={1290} durationInFrames={300} name="mathematical_proof">
        <MathematicalProof />
      </Sequence>
      <Sequence from={1590} durationInFrames={1500} name="the_puzzle">
        <ThePuzzle />
      </Sequence>
      <Sequence from={3090} durationInFrames={420} name="outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
}
