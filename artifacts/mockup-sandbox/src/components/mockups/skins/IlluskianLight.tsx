import {FontLinks, SkinHeader, Workspace} from "./_shared";

export default function IlluskianLight() {
  return <div className="skin-page illuskian-page light-stage">
    <FontLinks/>
    <SkinHeader eyebrow="SKIN STUDY · ILLUSKIAN" title="Light / frost mirror" description="Snow-bright surfaces and black ink; violet and teal remain reserved for interaction and focus."/>
    <Workspace theme={{name:"Illuskian Light",className:"skin-illuskian light",motif:"broken-path",description:"Frost White · Phantasm Violet · Chroma Teal"}}/>
    <section className="illuskian-light-note"><div className="broken-mark" aria-hidden="true"><i/><i/><i/></div><p><b>Open path.</b> Original fragmented ornament—not an official emblem. Borders retain the exact Steely Slate reference; small copy uses a lighter text derivative for contrast.</p></section>
  </div>;
}
