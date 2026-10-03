// Server-side adapter foundation. Not exposed by a route and not used by the preview.
// No order submission or publishing endpoint is implemented.
export type ProviderArea={position:string;width:number;height:number};
export type ProductDraftInput={title:string;blueprint_id:number;print_provider_id:number;variants:{id:number;price:number;is_enabled:boolean}[];print_areas:{variant_ids:number[];placeholders:{position:string;images:{id:string;x:number;y:number;scale:number;angle:number}[]}[]}[]};
export function createPrintifyClient(token:string,shopId:number,fetcher:typeof fetch=fetch){
 if(!token||!Number.isSafeInteger(shopId)||shopId<=0)throw new Error("Printify credentials are not configured");
 async function call(path:string,method="GET",payload?:unknown){
 const r=await fetcher("https://api.printify.com/v1/"+path,{method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","User-Agent":"LincForge/0.1"},body:payload===undefined?undefined:JSON.stringify(payload)});
 if(!r.ok)throw new Error("Printify request failed ("+r.status+"). Review the product/provider mapping before retrying.");
 return r.json();
 }
 return {
 listProducts:()=>call("shops/"+shopId+"/products.json"),
 getProviderVariants:(blueprintId:number,providerId:number)=>{if(!Number.isSafeInteger(blueprintId)||blueprintId<=0||!Number.isSafeInteger(providerId)||providerId<=0)throw new Error("Invalid provider");return call("catalog/blueprints/"+blueprintId+"/print_providers/"+providerId+"/variants.json");},
 createDraft:(input:ProductDraftInput)=>{if(!input.title||!input.variants.length||!input.print_areas.length)throw new Error("Incomplete product");return call("shops/"+shopId+"/products.json","POST",{...input,description:"MLBL Brotherhood collection",visible:false});}
 };
}

