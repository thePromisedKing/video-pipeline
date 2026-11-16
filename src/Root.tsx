import { CalculateMetadataFunction, Composition } from 'remotion';
import { beatSeconds, FPS, StoryProps, StoryVideo } from './StoryVideo';
import sample from '../videos/example-gita-2-47.json';

const SIZES = {
  vertical: { width: 1080, height: 1920 }, // Shorts / Reels / TikTok
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};

const calculateMetadata: CalculateMetadataFunction<StoryProps> = ({ props }) => ({
  ...SIZES[props.format ?? 'vertical'],
  durationInFrames: Math.max(
    1,
    props.beats.reduce((sum, b) => sum + Math.round(beatSeconds(b) * FPS), 0),
  ),
});

export const Root: React.FC = () => (
  <Composition
    id="StoryVideo"
    component={StoryVideo}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={1}
    defaultProps={sample as StoryProps}
    calculateMetadata={calculateMetadata}
  />
);
