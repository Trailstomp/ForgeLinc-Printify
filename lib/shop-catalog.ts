import {shopperSettings} from "./shopper-settings";
import {database} from "./storage";
import {STUDIO_OWNER_ID} from "./studio-access";
import {teams,customTeamSchema,customTeamView,configSchema,upgradeSleeveArtwork,teamLogoOptionsSchema,isTeamTemplate,artworkOptionAssetIds,type Draft} from "./catalog";
/** Only reusable team designs and offered artwork; never private selections or connections. */
export async function shopCatalog(){
 const db=database();const [settings,rows]=await Promise.all([
  db.prepare("SELECT id, config FROM templates WHERE owner=? AND (id LIKE 'team-definition:%' OR id LIKE 'team-logos:%')").bind(STUDIO_OWNER_ID).all<{id:string;config:string}>(),
  db.prepare("SELECT id, team_id, config, updated_at FROM drafts WHERE owner=? AND id LIKE 'brotherhood-v1:%'").bind(STUDIO_OWNER_ID).all<{id:string;team_id:string;config:string;updated_at:string}>()
 ]);
 const definitions=settings.results.filter(r=>r.id.startsWith("team-definition:")).map(r=>customTeamSchema.parse(JSON.parse(r.config)));
 const drafts:Draft[]=rows.results.map(r=>({id:r.id,teamId:r.team_id,config:{...upgradeSleeveArtwork(configSchema.parse(JSON.parse(r.config))),shopDomain:"",playerName:"",playerNumber:""},updatedAt:r.updated_at,status:"draft" as const})).filter(isTeamTemplate);
 const logoOptions=Object.fromEntries(settings.results.filter(r=>r.id.startsWith("team-logos:")).map(r=>[r.id.slice(11),teamLogoOptionsSchema.parse(JSON.parse(r.config))]));
 return {shopperSettings:await shopperSettings(),teams:[...teams,...definitions.map(customTeamView)],drafts,logoOptions,shopDomain:"",legacyTemplate:null,customTeams:[]};
}
export async function isShopArtwork(id:string){
 const shop=await shopCatalog();
 const refs=[...shop.drafts.flatMap(d=>[d.config.stripeAssetId,...Object.values(d.config.artwork).map(a=>a?.assetId)]),...Object.values(shop.logoOptions).flatMap(artworkOptionAssetIds),...shop.teams.flatMap(t=>[t.logo,t.back].filter(src=>src.startsWith("/api/artwork/")).map(src=>src.slice(13)))];
 return refs.includes(id);
}
