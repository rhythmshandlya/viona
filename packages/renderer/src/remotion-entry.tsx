import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { VideoComposition } from './components/VideoComposition';

// Load Google Fonts used by caption presets so they're available during
// headless browser rendering. Uses @remotion/google-fonts for bundling.
// Only latin subset and common weights to avoid timeout issues.

// --- Sans-serif ---
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';
import { loadFont as loadOpenSans } from '@remotion/google-fonts/OpenSans';
import { loadFont as loadLato } from '@remotion/google-fonts/Lato';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadRaleway } from '@remotion/google-fonts/Raleway';
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito';
import { loadFont as loadNunitoSans } from '@remotion/google-fonts/NunitoSans';
import { loadFont as loadUbuntu } from '@remotion/google-fonts/Ubuntu';
import { loadFont as loadRubik } from '@remotion/google-fonts/Rubik';
import { loadFont as loadNotoSans } from '@remotion/google-fonts/NotoSans';
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald';
import { loadFont as loadRobotoCondensed } from '@remotion/google-fonts/RobotoCondensed';
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans';
import { loadFont as loadKanit } from '@remotion/google-fonts/Kanit';
import { loadFont as loadWorkSans } from '@remotion/google-fonts/WorkSans';
import { loadFont as loadQuicksand } from '@remotion/google-fonts/Quicksand';
import { loadFont as loadBarlow } from '@remotion/google-fonts/Barlow';
import { loadFont as loadMulish } from '@remotion/google-fonts/Mulish';
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as loadKarla } from '@remotion/google-fonts/Karla';
import { loadFont as loadCabin } from '@remotion/google-fonts/Cabin';
import { loadFont as loadLibreFranklin } from '@remotion/google-fonts/LibreFranklin';
import { loadFont as loadOutfit } from '@remotion/google-fonts/Outfit';
import { loadFont as loadSourceSans3 } from '@remotion/google-fonts/SourceSans3';
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadPTSans } from '@remotion/google-fonts/PTSans';
import { loadFont as loadJosefinSans } from '@remotion/google-fonts/JosefinSans';
import { loadFont as loadTitilliumWeb } from '@remotion/google-fonts/TitilliumWeb';
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadOverpass } from '@remotion/google-fonts/Overpass';
import { loadFont as loadArimo } from '@remotion/google-fonts/Arimo';
import { loadFont as loadExo2 } from '@remotion/google-fonts/Exo2';
import { loadFont as loadComfortaa } from '@remotion/google-fonts/Comfortaa';
import { loadFont as loadMerriweatherSans } from '@remotion/google-fonts/MerriweatherSans';
import { loadFont as loadSignika } from '@remotion/google-fonts/Signika';
import { loadFont as loadRedRose } from '@remotion/google-fonts/RedRose';
import { loadFont as loadOxanium } from '@remotion/google-fonts/Oxanium';
import { loadFont as loadSofiaSansExtraCondensed } from '@remotion/google-fonts/SofiaSansExtraCondensed';
// --- Serif ---
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadLora } from '@remotion/google-fonts/Lora';
import { loadFont as loadMerriweather } from '@remotion/google-fonts/Merriweather';
import { loadFont as loadRobotoSlab } from '@remotion/google-fonts/RobotoSlab';
import { loadFont as loadPTSerif } from '@remotion/google-fonts/PTSerif';
import { loadFont as loadNotoSerif } from '@remotion/google-fonts/NotoSerif';
import { loadFont as loadEBGaramond } from '@remotion/google-fonts/EBGaramond';
import { loadFont as loadLibreBaskerville } from '@remotion/google-fonts/LibreBaskerville';
import { loadFont as loadSourceSerif4 } from '@remotion/google-fonts/SourceSerif4';
import { loadFont as loadCrimsonText } from '@remotion/google-fonts/CrimsonText';
import { loadFont as loadCormorantGaramond } from '@remotion/google-fonts/CormorantGaramond';
import { loadFont as loadBitter } from '@remotion/google-fonts/Bitter';
import { loadFont as loadDMSerifDisplay } from '@remotion/google-fonts/DMSerifDisplay';
import { loadFont as loadAbrilFatface } from '@remotion/google-fonts/AbrilFatface';
import { loadFont as loadVidaloka } from '@remotion/google-fonts/Vidaloka';
import { loadFont as loadSTIXTwoText } from '@remotion/google-fonts/STIXTwoText';
import { loadFont as loadGravitasOne } from '@remotion/google-fonts/GravitasOne';
import { loadFont as loadRakkas } from '@remotion/google-fonts/Rakkas';
// --- Display ---
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadLobster } from '@remotion/google-fonts/Lobster';
import { loadFont as loadPacifico } from '@remotion/google-fonts/Pacifico';
import { loadFont as loadPermanentMarker } from '@remotion/google-fonts/PermanentMarker';
import { loadFont as loadRighteous } from '@remotion/google-fonts/Righteous';
import { loadFont as loadFredoka } from '@remotion/google-fonts/Fredoka';
import { loadFont as loadLilitaOne } from '@remotion/google-fonts/LilitaOne';
import { loadFont as loadBangers } from '@remotion/google-fonts/Bangers';
import { loadFont as loadBungee } from '@remotion/google-fonts/Bungee';
import { loadFont as loadBlackOpsOne } from '@remotion/google-fonts/BlackOpsOne';
import { loadFont as loadAudiowide } from '@remotion/google-fonts/Audiowide';
import { loadFont as loadCreepster } from '@remotion/google-fonts/Creepster';
import { loadFont as loadBoogaloo } from '@remotion/google-fonts/Boogaloo';
import { loadFont as loadPixelifySans } from '@remotion/google-fonts/PixelifySans';
import { loadFont as loadRye } from '@remotion/google-fonts/Rye';
import { loadFont as loadNewRocker } from '@remotion/google-fonts/NewRocker';
import { loadFont as loadVastShadow } from '@remotion/google-fonts/VastShadow';
import { loadFont as loadSancreek } from '@remotion/google-fonts/Sancreek';
import { loadFont as loadAmarante } from '@remotion/google-fonts/Amarante';
import { loadFont as loadMetamorphous } from '@remotion/google-fonts/Metamorphous';
import { loadFont as loadRibeye } from '@remotion/google-fonts/Ribeye';
import { loadFont as loadChicle } from '@remotion/google-fonts/Chicle';
import { loadFont as loadPressStart2P } from '@remotion/google-fonts/PressStart2P';
import { loadFont as loadAgbalumo } from '@remotion/google-fonts/Agbalumo';
// --- Handwriting ---
import { loadFont as loadDancingScript } from '@remotion/google-fonts/DancingScript';
import { loadFont as loadCaveat } from '@remotion/google-fonts/Caveat';
import { loadFont as loadSatisfy } from '@remotion/google-fonts/Satisfy';
import { loadFont as loadGreatVibes } from '@remotion/google-fonts/GreatVibes';
import { loadFont as loadSacramento } from '@remotion/google-fonts/Sacramento';
import { loadFont as loadShadowsIntoLight } from '@remotion/google-fonts/ShadowsIntoLight';
import { loadFont as loadIndieFlower } from '@remotion/google-fonts/IndieFlower';
import { loadFont as loadKalam } from '@remotion/google-fonts/Kalam';
import { loadFont as loadCourgette } from '@remotion/google-fonts/Courgette';
import { loadFont as loadPangolin } from '@remotion/google-fonts/Pangolin';
import { loadFont as loadMansalva } from '@remotion/google-fonts/Mansalva';
import { loadFont as loadBerkshireSwash } from '@remotion/google-fonts/BerkshireSwash';
import { loadFont as loadEagleLake } from '@remotion/google-fonts/EagleLake';
// --- Monospace ---
import { loadFont as loadRobotoMono } from '@remotion/google-fonts/RobotoMono';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadFiraCode } from '@remotion/google-fonts/FiraCode';
import { loadFont as loadSourceCodePro } from '@remotion/google-fonts/SourceCodePro';
import { loadFont as loadIBMPlexMono } from '@remotion/google-fonts/IBMPlexMono';
import { loadFont as loadSpaceMono } from '@remotion/google-fonts/SpaceMono';
import { loadFont as loadInconsolata } from '@remotion/google-fonts/Inconsolata';

// Load all fonts at bundle time — only latin subset and common weights
const S = 'normal';
const L = { subsets: ['latin'] as const };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = (...ws: string[]) => ({ weights: ws, ...L }) as any;

// Sans-serif
loadRoboto(S, w('400', '500', '700', '900'));
loadOpenSans(S, w('400', '500', '600', '700', '800'));
loadLato(S, w('400', '700', '900'));
loadMontserrat(S, w('400', '500', '600', '700', '800', '900'));
loadPoppins(S, w('400', '500', '600', '700', '800', '900'));
loadInter(S, w('400', '500', '600', '700', '800', '900'));
loadRaleway(S, w('400', '500', '600', '700', '800', '900'));
loadNunito(S, w('400', '600', '700', '800', '900'));
loadNunitoSans(S, w('400', '600', '700', '800', '900'));
loadUbuntu(S, w('400', '500', '700'));
loadRubik(S, w('400', '500', '600', '700', '800', '900'));
loadNotoSans(S, w('400', '500', '600', '700', '800', '900'));
loadOswald(S, w('400', '500', '600', '700'));
loadRobotoCondensed(S, w('400', '500', '700', '900'));
loadDMSans(S, w('400', '500', '600', '700'));
loadKanit(S, w('400', '500', '600', '700', '800', '900'));
loadWorkSans(S, w('400', '500', '600', '700', '800', '900'));
loadQuicksand(S, w('400', '500', '600', '700'));
loadBarlow(S, w('400', '500', '600', '700', '800', '900'));
loadMulish(S, w('400', '500', '600', '700', '800', '900'));
loadManrope(S, w('400', '500', '600', '700', '800'));
loadKarla(S, w('400', '500', '600', '700', '800'));
loadCabin(S, w('400', '500', '600', '700'));
loadLibreFranklin(S, w('400', '500', '600', '700', '800', '900'));
loadOutfit(S, w('400', '500', '600', '700', '800'));
loadSourceSans3(S, w('400', '600', '700'));
loadSpaceGrotesk(S, w('400', '500', '600', '700'));
loadPTSans(S, w('400', '700'));
loadJosefinSans(S, w('400', '500', '600', '700'));
loadTitilliumWeb(S, w('400', '600', '700', '900'));
loadArchivo(S, w('400', '500', '600', '700', '800', '900'));
loadOverpass(S, w('400', '500', '600', '700', '800', '900'));
loadArimo(S, w('400', '500', '600', '700'));
loadExo2(S, w('400', '500', '600', '700', '800', '900'));
loadComfortaa(S, w('400', '500', '600', '700'));
loadMerriweatherSans(S, w('400', '500', '600', '700', '800'));
loadSignika(S, w('400', '500', '600', '700'));
loadRedRose(S, w('400', '500', '600', '700'));
loadOxanium(S, w('400', '500', '600', '700', '800'));
loadSofiaSansExtraCondensed(S, w('400', '500', '600', '700', '800', '900'));
// Serif
loadPlayfairDisplay(S, w('400', '500', '600', '700', '800', '900'));
loadLora(S, w('400', '500', '600', '700'));
loadMerriweather(S, w('400', '700', '900'));
loadRobotoSlab(S, w('400', '500', '600', '700', '800', '900'));
loadPTSerif(S, w('400', '700'));
loadNotoSerif(S, w('400', '500', '600', '700', '800', '900'));
loadEBGaramond(S, w('400', '500', '600', '700', '800'));
loadLibreBaskerville(S, w('400', '700'));
loadSourceSerif4(S, w('400', '500', '600', '700', '800', '900'));
loadCrimsonText(S, w('400', '600', '700'));
loadCormorantGaramond(S, w('400', '500', '600', '700'));
loadBitter(S, w('400', '500', '600', '700', '800', '900'));
loadDMSerifDisplay(S, w('400'));
loadAbrilFatface(S, w('400'));
loadVidaloka(S, w('400'));
loadSTIXTwoText(S, w('400', '500', '600', '700'));
loadGravitasOne(S, w('400'));
loadRakkas(S, w('400'));
// Display
loadAnton(S, w('400'));
loadBebasNeue(S, w('400'));
loadLobster(S, w('400'));
loadPacifico(S, w('400'));
loadPermanentMarker(S, w('400'));
loadRighteous(S, w('400'));
loadFredoka(S, w('400', '500', '600', '700'));
loadLilitaOne(S, w('400'));
loadBangers(S, w('400'));
loadBungee(S, w('400'));
loadBlackOpsOne(S, w('400'));
loadAudiowide(S, w('400'));
loadCreepster(S, w('400'));
loadBoogaloo(S, w('400'));
loadPixelifySans(S, w('400', '500', '600', '700'));
loadRye(S, w('400'));
loadNewRocker(S, w('400'));
loadVastShadow(S, w('400'));
loadSancreek(S, w('400'));
loadAmarante(S, w('400'));
loadMetamorphous(S, w('400'));
loadRibeye(S, w('400'));
loadChicle(S, w('400'));
loadPressStart2P(S, w('400'));
loadAgbalumo(S, w('400'));
// Handwriting
loadDancingScript(S, w('400', '500', '600', '700'));
loadCaveat(S, w('400', '500', '600', '700'));
loadSatisfy(S, w('400'));
loadGreatVibes(S, w('400'));
loadSacramento(S, w('400'));
loadShadowsIntoLight(S, w('400'));
loadIndieFlower(S, w('400'));
loadKalam(S, w('400', '700'));
loadCourgette(S, w('400'));
loadPangolin(S, w('400'));
loadMansalva(S, w('400'));
loadBerkshireSwash(S, w('400'));
loadEagleLake(S, w('400'));
// Monospace
loadRobotoMono(S, w('400', '500', '600', '700'));
loadJetBrainsMono(S, w('400', '500', '600', '700', '800'));
loadFiraCode(S, w('400', '500', '600', '700'));
loadSourceCodePro(S, w('400', '500', '600', '700', '800', '900'));
loadIBMPlexMono(S, w('400', '500', '600', '700'));
loadSpaceMono(S, w('400', '700'));
loadInconsolata(S, w('400', '500', '600', '700', '800', '900'));

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VionaVideo"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={VideoComposition as any}
        durationInFrames={30 * 60} // Will be overridden
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);
