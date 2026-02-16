import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { VideoComposition } from './components/VideoComposition';

// Load ALL Google Fonts used by caption presets so they're available during
// headless browser rendering. This is the same approach as the web app preview
// (loading fonts via Google Fonts) but using @remotion/google-fonts for bundling.
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito';
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';
import { loadFont as loadMerriweather } from '@remotion/google-fonts/Merriweather';
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans';
import { loadFont as loadOutfit } from '@remotion/google-fonts/Outfit';
import { loadFont as loadRubik } from '@remotion/google-fonts/Rubik';
import { loadFont as loadLora } from '@remotion/google-fonts/Lora';
import { loadFont as loadSourceSans3 } from '@remotion/google-fonts/SourceSans3';
import { loadFont as loadFiraCode } from '@remotion/google-fonts/FiraCode';
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald';
import { loadFont as loadLato } from '@remotion/google-fonts/Lato';
import { loadFont as loadOpenSans } from '@remotion/google-fonts/OpenSans';

// Load all fonts at bundle time — only latin subset and common weights
// to avoid timeout issues in headless rendering
loadInter('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] });
loadAnton('normal', { weights: ['400'], subsets: ['latin'] });
loadMontserrat('normal', { weights: ['300', '400', '500', '600', '700', '800', '900'], subsets: ['latin'] });
loadPoppins('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] });
loadNunito('normal', { weights: ['400', '600', '700', '800', '900'], subsets: ['latin'] });
loadPlayfairDisplay('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] });
loadJetBrainsMono('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] });
loadRoboto('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
loadMerriweather('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });
loadBebasNeue('normal', { weights: ['400'], subsets: ['latin'] });
loadSpaceGrotesk('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
loadDMSans('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
loadOutfit('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] });
loadRubik('normal', { weights: ['400', '500', '600', '700', '800', '900'], subsets: ['latin'] });
loadLora('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
loadSourceSans3('normal', { weights: ['400', '600', '700'], subsets: ['latin'] });
loadFiraCode('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
loadOswald('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
loadLato('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });
loadOpenSans('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] });

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VionaVideo"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={VideoComposition as any}
        durationInFrames={30 * 60} // Will be overridden
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          videoUrl: '',
          subtitles: [],
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
