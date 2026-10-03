import data from "./teams.json";
import { z } from "zod";
export type Team = typeof data[number] & {kind?:"team"|"league";custom?:boolean};
export const teams:Team[] = [...data,{id:"mlbl",name:"MLBL",logo:"/assets/mlbl.png",back:"/assets/mlbl.png",primary:"#092c49",accent:"#cc1428",mirror:false,kind:"league"}];
export const customTeamSchema=z.object({id:z.string().regex(/^custom-team-[0-9a-f-]{36}$/),name:z.string().trim().min(1).max(80),kind:z.enum(["team","league"]),primary:z.string().regex(/^#[0-9a-fA-F]{6}$/),accent:z.string().regex(/^#[0-9a-fA-F]{6}$/),logoAssetId:z.string().uuid().nullable(),backAssetId:z.string().uuid().nullable()}).strict();
export type CustomTeam=z.infer<typeof customTeamSchema>;
export function customTeamView(t:CustomTeam):Team{return {id:t.id,name:t.name,kind:t.kind,custom:true,primary:t.primary,accent:t.accent,logo:t.logoAssetId?"/api/artwork/"+t.logoAssetId:"/assets/mlbl.png",back:t.backAssetId?"/api/artwork/"+t.backAssetId:"/assets/mlbl.png",mirror:false};}
export const teamIdSchema=z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);
export const panels = [
 {id:"front",name:"Front",width:4649,height:5427},
 {id:"back",name:"Back",width:4655,height:5426},
 {id:"left-sleeve",name:"Left sleeve",width:3914,height:1938},
 {id:"right-sleeve",name:"Right sleeve",width:3915,height:1938},
 {id:"collar",name:"Collar",width:3662,height:318},
] as const;
export type PanelId = typeof panels[number]["id"];
export const artworkPanels=["front","back","left-sleeve","right-sleeve","collar"] as const;
export type ArtworkPanel=typeof artworkPanels[number];
export const artworkLayerSchema=z.object({assetId:z.string().uuid().nullable(),visible:z.boolean(),x:z.number().min(0).max(1),y:z.number().min(0).max(1),scale:z.number().min(.2).max(3),caption:z.boolean()}).strict();
export type ArtworkLayer=z.infer<typeof artworkLayerSchema>;
const artworkSchema=z.object({front:artworkLayerSchema.optional(),back:artworkLayerSchema.optional(),"left-sleeve":artworkLayerSchema.optional(),"right-sleeve":artworkLayerSchema.optional(),collar:artworkLayerSchema.optional()}).strict();
export const jerseyThemeSchema=z.union([z.enum(["light","dark"]),z.string().refine(v=>v.startsWith("custom:")&&z.string().uuid().safeParse(v.slice(7)).success)]);
export const isCustomTheme=(theme:string)=>theme.startsWith("custom:");
export const configSchema = z.object({
 jerseyTheme:jerseyThemeSchema.default("light"),
 playerName:z.string().max(24).regex(/^[^\u0000-\u001f\u007f]*$/).default(""),
 playerNumber:z.string().regex(/^[0-9]{0,3}$/).default(""),
 backBadgePosition:z.enum(["top","bottom","waist"]).default("waist"),
 themeName:z.string().trim().max(80).default(""),
 frontLogoLabel:z.string().trim().min(1).max(80).default("Team crest"),
 primary:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 accent:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 shirtColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
 trimColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#c4c8cc"),
 frontScale:z.number().min(.22).max(.43),
 frontY:z.number().min(.25).max(.43),
 backScale:z.number().min(.35).max(.5),
 backY:z.number().min(.2).max(.32),
 backBehindStripes:z.boolean().default(true),
 stripeStyle:z.enum(["sweep","angular","curved","straight","lightning","twist","blade-bolts","pixels","digital-camo","none","custom"]).default("sweep"),
 stripeLayout:z.enum(["wedges","bands"]).optional(),
 stripeAssetId:z.string().uuid().nullable().default(null),
 bandHeight:z.number().min(.08).max(.4).default(.18),
 stripeHeight:z.number().min(.2).max(.7).default(.5),
 includeQR:z.boolean(),
 sleeveStyle:z.enum(["legacy","membership-head-v1"]).default("legacy"),
 artwork:artworkSchema.default({}),
 shopDomain:z.string().max(100).refine(s=>s===""||/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)),
}).strict();
export type TemplateConfig = z.infer<typeof configSchema>;
export const defaultConfig:TemplateConfig={playerName:"",playerNumber:"",backBadgePosition:"waist",jerseyTheme:"light",themeName:"",frontLogoLabel:"Team crest",primary:"#092c49",accent:"#cd1428",shirtColor:"#ffffff",trimColor:"#c4c8cc",frontScale:.36,frontY:.30,backScale:.46,backY:.28,backBehindStripes:true,stripeStyle:"sweep",stripeLayout:undefined,stripeAssetId:null,stripeHeight:.5,bandHeight:.18,includeQR:true,sleeveStyle:"membership-head-v1",artwork:{},shopDomain:""};
// Upgrade saved working templates once; subsequent edits (including deletion or
// replacement) are respected. Historical Printify snapshots are never upgraded.
export function upgradeSleeveArtwork(cfg:TemplateConfig):TemplateConfig {
 // Rebase the former constrained back position once for the new automatic
 // name-aware layout. Explicit custom images and historical transfers stay intact.
 if(cfg.backBadgePosition!=="waist"){
  const back=cfg.artwork.back;
  cfg={...cfg,backBadgePosition:"waist",artwork:back&&!back.assetId?{...cfg.artwork,back:{...back,y:artworkLayer({...cfg,artwork:{}},"back").y}}:cfg.artwork};
 }
 if(cfg.sleeveStyle==="membership-head-v1")return cfg;
 return {...cfg,sleeveStyle:"membership-head-v1",includeQR:true,artwork:{...cfg.artwork,
  "left-sleeve":{...artworkLayer(cfg,"left-sleeve"),visible:false,caption:false},
  "right-sleeve":{assetId:null,visible:true,x:.5,y:.38,scale:1,caption:false}
 }};
}
export type Draft={id:string;teamId:string;config:TemplateConfig;updatedAt:string;status:"draft"};
export function getTeam(id:string,catalog:Team[]=teams){const t=catalog.find(t=>t.id===id);if(!t)throw new Error("Unknown team");return t;}
export type JerseyTheme=z.infer<typeof jerseyThemeSchema>;
export function themeLabel(config:Pick<TemplateConfig,"jerseyTheme"|"themeName">){return config.jerseyTheme==="light"?"Light":config.jerseyTheme==="dark"?"Dark":config.themeName||"Custom theme";}
export function draftKey(teamId:string,theme:JerseyTheme="light"){teamIdSchema.parse(teamId);return "brotherhood-v1:"+teamId+(theme==="light"?"":":"+theme);}
export function isTeamTemplate(d:Draft){return d.id===draftKey(d.teamId,d.config.jerseyTheme);}
export function themeDesign(base:TemplateConfig,theme:JerseyTheme):TemplateConfig {return base.jerseyTheme===theme?base:{...base,jerseyTheme:theme,themeName:isCustomTheme(theme)?base.themeName:"",shirtColor:theme==="dark"?"#101820":"#ffffff",primary:theme==="dark"?"#e9edf0":base.primary,artwork:structuredClone(base.artwork)};}
export function teamDefaultConfig(teamId:string,catalog:Team[]=teams):TemplateConfig {
 const team=getTeam(teamId,catalog);
 return {...defaultConfig,primary:team.primary,accent:team.accent};
}
export const teamDesignSchema=z.object({teamId:teamIdSchema,config:configSchema}).strict().refine(d=>!isCustomTheme(d.config.jerseyTheme)||!!d.config.themeName.trim());
export const generateSchema=z.object({designs:z.array(teamDesignSchema).min(1).max(100).refine(ds=>new Set(ds.map(d=>d.teamId+":"+d.config.jerseyTheme)).size===ds.length)}).strict();
export function sameDesign(a:TemplateConfig,b:TemplateConfig){
 return (Object.keys(defaultConfig) as (keyof TemplateConfig)[]).every(k=>k==="shopDomain"||(k==="artwork"?JSON.stringify(artworkSchema.parse(a.artwork??{}))===JSON.stringify(artworkSchema.parse(b.artwork??{})):a[k]===b[k]));
}
export function artworkLayer(cfg:TemplateConfig,id:ArtworkPanel,dimensions?:{width:number;height:number}):ArtworkLayer{
 const p=dimensions??panels.find(p=>p.id===id)!;
 const membership=cfg.sleeveStyle==="membership-head-v1";
 const y=id==="collar"?.5:id==="front"?cfg.frontY+.215:id==="back"?cfg.backY+cfg.backScale*p.width/p.height*.75:id==="left-sleeve"?.515:membership?.38:.49;
 return cfg.artwork?.[id]??{assetId:null,visible:id==="collar"?false:id==="left-sleeve"?!membership:id!=="right-sleeve"||cfg.includeQR,x:.5,y,scale:1,caption:!membership};
}

export const panelLogoOptionsSchema=z.object({allowUploads:z.boolean(),offerOriginal:z.boolean().optional(),logos:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(80),assetId:z.string().uuid()}).strict()).max(12).refine(items=>new Set(items.map(i=>i.id)).size===items.length)}).strict();
export type PanelLogoOptions=z.infer<typeof panelLogoOptionsSchema>;
export const teamLogoOptionsSchema=panelLogoOptionsSchema.extend({positions:z.object({back:panelLogoOptionsSchema.optional(),"left-sleeve":panelLogoOptionsSchema.optional(),"right-sleeve":panelLogoOptionsSchema.optional(),collar:panelLogoOptionsSchema.optional()}).strict().optional()}).strict();
export type TeamLogoOptions=z.infer<typeof teamLogoOptionsSchema>;
export const defaultLogoOptions:TeamLogoOptions={allowUploads:true,logos:[]};
/** The master switch limits uploads without changing saved per-panel preferences. */
export function shopperLogoOptions(options:TeamLogoOptions,allowCustomImages:boolean):TeamLogoOptions{
 if(allowCustomImages)return options;
 return {...options,allowUploads:false,positions:Object.fromEntries(Object.entries(options.positions??{}).map(([panel,value])=>[panel,value?{...value,allowUploads:false}:value]))};
}
export function panelLogoOptions(options:TeamLogoOptions,panel:ArtworkPanel):PanelLogoOptions{return panel==="front"?{allowUploads:options.allowUploads,offerOriginal:options.offerOriginal,logos:options.logos}:options.positions?.[panel]??{allowUploads:false,logos:[]};}
export function setPanelLogoOptions(options:TeamLogoOptions,panel:ArtworkPanel,value:PanelLogoOptions):TeamLogoOptions{return panel==="front"?{...options,...value}:{...options,positions:{...options.positions,[panel]:value}};}
export function artworkOptionAssetIds(options:TeamLogoOptions){return artworkPanels.flatMap(panel=>panelLogoOptions(options,panel).logos.map(logo=>logo.assetId));}
export function originalArtworkLayer(config:TemplateConfig,panel:ArtworkPanel){return artworkLayer({...config,artwork:{}},panel);}
export function restoreOriginalArtwork(config:TemplateConfig,panel:ArtworkPanel):TemplateConfig{
 const original=originalArtworkLayer(config,panel),current=artworkLayer(config,panel);
 return {...config,...(panel==="front"?{frontLogoLabel:"Team crest"}:{}),artwork:{...config.artwork,[panel]:{...current,assetId:null,visible:original.visible,caption:original.caption}}};
}
export function originalArtworkSource(team:Team,config:TemplateConfig,panel:ArtworkPanel):string|null{
 if(!originalArtworkLayer(config,panel).visible)return null;
 return panel==="front"?team.logo:panel==="back"?team.back:panel==="right-sleeve"?(config.sleeveStyle==="membership-head-v1"?"/assets/membership-head-angled-v2.png":"/assets/qr.png"):panel==="left-sleeve"?"/assets/mlbl.png":null;
}
export function withPanelArtwork(config:TemplateConfig,panel:ArtworkPanel,assetId:string,name:string):TemplateConfig{return {...config,...(panel==="front"?{frontLogoLabel:name}:{}),artwork:{...config.artwork,[panel]:{...artworkLayer(config,panel),assetId,visible:true,caption:false}}};}
export function withFrontLogo(config:TemplateConfig,assetId:string,name:string):TemplateConfig{return withPanelArtwork(config,"front",assetId,name);}
export type ArtworkChoice={id:string;assetId?:string;name:string};
export type PanelChoices=Partial<Record<ArtworkPanel,ArtworkChoice>>;
export function applyArtworkChoices(config:TemplateConfig,choices:PanelChoices,options:TeamLogoOptions){
 let result=config;
 for(const panel of artworkPanels){const choice=choices[panel],policy=panelLogoOptions(options,panel);if(!choice)continue;
  if(choice.id==="original"){if(policy.offerOriginal!==false)result=restoreOriginalArtwork(result,panel);continue;}
  const approved=choice.id==="upload"?(policy.allowUploads?choice:null):policy.logos.find(l=>l.id===choice.id&&l.assetId===choice.assetId);
  if(approved?.assetId)result=withPanelArtwork(result,panel,approved.assetId,approved.name);
 }
 return result;
}
