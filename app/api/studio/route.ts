import {SHOPPER_SETTINGS_ID,parseShopperSettings} from "@/lib/shopper-settings";
import {isStudioAdmin} from "@/lib/studio-access";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {database} from "@/lib/storage";
import {configSchema,generateSchema,draftKey,upgradeSleeveArtwork,teamLogoOptionsSchema,artworkOptionAssetIds,jerseyThemeSchema,isCustomTheme,teams,customTeamSchema,customTeamView,type Draft} from "@/lib/catalog";
import {validateArtworkOwnership} from "@/lib/artwork-storage";
import {ownerTeams} from "@/lib/team-storage";
import {ConnectionError} from "@/lib/shopify-connection";
const ARCHIVE_PREFIX="archived-draft:";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:"Please sign in to load your studio."},401);
 if(!isStudioAdmin(user))return json({error:"Merch Studio is reserved for the ForgeLinc administrator."},403);
 try{const db=database();const [settings,rows]=await Promise.all([
 db.prepare("SELECT id, config FROM templates WHERE owner=?").bind(user.userId).all<{id:string;config:string}>(),
 db.prepare("SELECT id, team_id, config, updated_at FROM drafts WHERE owner=? ORDER BY updated_at DESC, team_id").bind(user.userId).all<{id:string;team_id:string;config:string;updated_at:string}>()
 ]);
 const legacy=settings.results.find(r=>r.id==="brotherhood-v1");
 const legacyTemplate=legacy?upgradeSleeveArtwork(configSchema.parse(JSON.parse(legacy.config))):null;
 const connection=settings.results.find(r=>r.id==="store-connection");
 const shopDomain=connection?configSchema.shape.shopDomain.parse(JSON.parse(connection.config).shopDomain):legacyTemplate?.shopDomain??"";
 const drafts:Draft[]=rows.results.map(r=>({id:r.id,teamId:r.team_id,config:upgradeSleeveArtwork(configSchema.parse(JSON.parse(r.config))),updatedAt:r.updated_at,status:"draft"}));
 const logoOptions=Object.fromEntries(settings.results.filter(r=>r.id.startsWith("team-logos:")).map(r=>[r.id.slice(11),teamLogoOptionsSchema.parse(JSON.parse(r.config))]));
 const customTeams=settings.results.filter(r=>r.id.startsWith("team-definition:")).map(r=>customTeamSchema.parse(JSON.parse(r.config)));
 return json({archivedDraftIds:settings.results.filter(r=>r.id.startsWith(ARCHIVE_PREFIX)).map(r=>r.id.slice(ARCHIVE_PREFIX.length)),shopperSettings:parseShopperSettings(settings.results.find(r=>r.id===SHOPPER_SETTINGS_ID)?.config),shopDomain,legacyTemplate,drafts,logoOptions,teams:[...teams,...customTeams.map(customTeamView)],customTeams});
 }catch(e){console.error("studio load failed",e);return json({error:"We couldn't load your saved workspace. Please try again."},503);}
}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Please sign in to save your studio."},401);
 if(!isStudioAdmin(user))return json({error:"Merch Studio is reserved for the ForgeLinc administrator."},403);
 const origin=req.headers.get("origin");
 if(!origin||origin!==new URL(req.url).origin)return json({error:"Invalid request origin."},403);
 const rawText=await req.text();if(rawText.length>50000)return json({error:"Request too large."},413);
 let raw:unknown;try{raw=JSON.parse(rawText);}catch{return json({error:"Invalid request."},400);}
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return json({error:"Invalid request."},400);
 const body=raw as Record<string,unknown>;
 try{
 const db=database();const now=new Date().toISOString();
 if(body.action==="archive-draft"||body.action==="restore-draft"){
 if(typeof body.draftId!=="string"||body.draftId.length>200||!body.draftId.startsWith("selection:"))return json({error:"Team templates stay available for your shop. Only custom selections can be archived."},400);
 const draft=await db.prepare("SELECT id FROM drafts WHERE owner=? AND id=?").bind(user.userId,body.draftId).first<{id:string}>();
 if(!draft)return json({error:"This saved selection could not be found."},404);
 const archived=body.action==="archive-draft",id=ARCHIVE_PREFIX+draft.id;
 if(archived)await db.prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(user.userId,id,JSON.stringify({archived:true}),now).run();
 else await db.prepare("DELETE FROM templates WHERE owner=? AND id=?").bind(user.userId,id).run();
 return json({saved:true,draftId:draft.id,archived});
 }
 if(body.action==="save-shopper-settings"){
 if(typeof body.allowCustomImages!=="boolean")return json({error:"Choose whether customers can upload images."},400);
 const settings={allowCustomImages:body.allowCustomImages};
 await db.prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(user.userId,SHOPPER_SETTINGS_ID,JSON.stringify(settings),now).run();
 return json({saved:true,shopperSettings:settings});
 }
 const availableTeams=await ownerTeams(user.userId);
 if(body.action==="save-team"){
 const parsed=customTeamSchema.safeParse(body.team);if(!parsed.success)return json({error:"Enter a team name, valid colors and uploaded artwork."},400);
 const definition=parsed.data;
 if(availableTeams.some(t=>t.id!==definition.id&&t.name.toLocaleLowerCase()===definition.name.toLocaleLowerCase()))return json({error:"That name is already in your teams and collections."},409);
 await validateArtworkOwnership(user.userId,[],[definition.logoAssetId,definition.backAssetId].filter((id):id is string=>!!id));
 await db.prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(user.userId,"team-definition:"+definition.id,JSON.stringify(definition),now).run();
 return json({saved:true,team:customTeamView(definition),definition});
 }
 if(body.action==="save-store"){
 const domain=configSchema.shape.shopDomain.safeParse(body.shopDomain);if(!domain.success)return json({error:"Enter a valid myshopify.com store address."},400);
 await db.prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(user.userId,"store-connection",JSON.stringify({shopDomain:domain.data}),now).run();
 return json({saved:true});
 }
 if(body.action==="save-logo-options"){
 const options=teamLogoOptionsSchema.safeParse(body.options);
 if(typeof body.teamId!=="string"||!availableTeams.some(t=>t.id===body.teamId)||!options.success)return json({error:"Choose valid team logo options."},400);
 await validateArtworkOwnership(user.userId,[],artworkOptionAssetIds(options.data));
 await db.prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(user.userId,"team-logos:"+body.teamId,JSON.stringify(options.data),now).run();
 return json({saved:true});
 }
 if(body.action==="delete-theme"){
 const theme=jerseyThemeSchema.safeParse(body.theme);
 if(typeof body.teamId!=="string"||!availableTeams.some(t=>t.id===body.teamId)||!theme.success||!isCustomTheme(theme.data))return json({error:"Choose a custom team theme to remove. Light and Dark are kept."},400);
 const id=draftKey(body.teamId,theme.data);
 await db.prepare("DELETE FROM drafts WHERE owner=? AND id=? AND team_id=?").bind(user.userId,id,body.teamId).run();
 return json({removed:id});
 }
 if(body.action==="save"||body.action==="generate"||body.action==="save-selection"){
 const parsed=body.action!=="generate"
 ?generateSchema.safeParse({designs:[{teamId:body.teamId,config:body.config}]})
 :generateSchema.safeParse({designs:body.designs});
 if(!parsed.success||parsed.data.designs.some(d=>!availableTeams.some(t=>t.id===d.teamId)))return json({error:"Choose valid teams and settings for each team. Refresh the page if it was already open."},400);
 await validateArtworkOwnership(user.userId,parsed.data.designs.map(d=>d.config));
 const drafts:Draft[]=parsed.data.designs.map(d=>({id:body.action==="save-selection"?"selection:"+crypto.randomUUID():draftKey(d.teamId,d.config.jerseyTheme),teamId:d.teamId,config:upgradeSleeveArtwork(body.action==="save-selection"?d.config:{...d.config,playerName:"",playerNumber:""}),updatedAt:now,status:"draft"}));
 await db.batch(drafts.map(d=>db.prepare("INSERT INTO drafts(owner,id,team_id,config,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(user.userId,d.id,d.teamId,JSON.stringify(d.config),now)));
 return json({saved:true,count:drafts.length,drafts});
 }
 return json({error:"Unknown action."},400);
 }catch(e){if(e instanceof ConnectionError)return json({error:e.message},e.status);console.error("studio save failed");return json({error:"We couldn't save that change. Your settings are still on screen; please retry."},503);}
}
