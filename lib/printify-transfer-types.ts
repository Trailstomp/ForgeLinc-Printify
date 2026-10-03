import type {PanelId,TemplateConfig,Team} from "./catalog";
export type PrintArea={panel:PanelId;position:string;width:number;height:number;decoration_method?:string};
export type TransferVariant={id:number;title:string;size:string;areas:PrintArea[]};
export type JerseyCatalog={blueprint:{id:number;title:string};provider:{id:number;title:string};variants:TransferVariant[]};
export type TransferSnapshot={teamId:string;team?:Team;config:TemplateConfig;shopId:number;catalog:JerseyCatalog;variant:TransferVariant;price:number;order?:{id:string;lineId:string;name:string;quantity:number}};
export type TransferProduct={id:string;title:string;images:{src:string;position:string}[]};
export type Transfer={id:string;snapshot:TransferSnapshot;uploaded:string[];status:"preparing"|"creating"|"uncertain"|"created";product:TransferProduct|null;updatedAt:string};
