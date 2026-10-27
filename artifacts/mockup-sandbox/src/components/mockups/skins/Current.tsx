import {FontLinks, SkinHeader, Workspace} from "./_shared";

export default function Current() {
  return <div className="skin-page">
    <FontLinks/>
    <SkinHeader eyebrow="REFERENCE · SOURCE TOKENS" title="Current palette" description="Component comparison in a representative shell. This is not an exact full-app screenshot."/>
    <Workspace theme={{name:"Current",className:"skin-current",motif:"",description:"Original campaign palette"}}/>
    <p className="comparison-caption">Baseline tokens copied from <code>client/src/index.css</code>: Cinzel display, Lato body, warm charcoal and parchment, gold primary, leather secondary, and blood-red destructive.</p>
  </div>;
}
