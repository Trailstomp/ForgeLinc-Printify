import {database} from "./storage";
import {teams,customTeamSchema,customTeamView,getTeam} from "./catalog";
import {ConnectionError} from "./shopify-connection";
export async function ownerTeams(owner:string){const rows=await database().prepare("SELECT config FROM templates WHERE owner=? AND id LIKE 'team-definition:%'").bind(owner).all<{config:string}>();return [...teams,...rows.results.map(r=>customTeamView(customTeamSchema.parse(JSON.parse(r.config))))];}
export async function ownerTeam(owner:string,id:string){const catalog=await ownerTeams(owner);if(!catalog.some(t=>t.id===id))throw new ConnectionError("Choose a team from your workspace.",404);return getTeam(id,catalog);}
