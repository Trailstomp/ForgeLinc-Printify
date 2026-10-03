import {database} from "./storage";
import {STUDIO_OWNER_ID} from "./studio-access";

export const SHOPPER_SETTINGS_ID="shopper-settings";
export function parseShopperSettings(config?:string){
 const value=config?JSON.parse(config):{};
 return {allowCustomImages:value.allowCustomImages===true};
}
export async function shopperSettings(){
 const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(STUDIO_OWNER_ID,SHOPPER_SETTINGS_ID).first<{config:string}>();
 return parseShopperSettings(row?.config);
}
