import {FontLinks, SkinHeader, Workspace} from "./_shared";
import {Sparkles} from "lucide-react";

export default function IlluskianDark() {
  return <div className="skin-page illuskian-page">
    <FontLinks/>
    <SkinHeader eyebrow="SKIN STUDY · ILLUSKIAN" title="Dark / scrying glass" description="Glacial Black with restrained violet and teal refraction. Readable combat state stays opaque where it matters."/>
    <Workspace theme={{name:"Illuskian Dark",className:"skin-illuskian",motif:"broken-path",description:"Glacial Black · Phantasm Violet · Chroma Teal"}}/>
    <section className="illuskian-notes">
      <div className="broken-mark" aria-hidden="true"><i/><i/><i/></div>
      <div><span className="eyebrow">OPTIONAL MOTION SPECIMEN · NOT A REAL LOADER</span><h2>Mirror shimmer</h2><p>Violet–teal shimmer is shown only as an optional loading-animation concept. No game action is waiting on it.</p><div className="optional-loader" aria-hidden="true"/></div>
      <Sparkles size={17} aria-hidden="true" className="specimen-sparkle"/>
    </section>
  </div>;
}
