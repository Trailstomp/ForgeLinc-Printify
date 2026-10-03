import type {TemplateConfig} from "./catalog";
export const CHECKOUT_PRODUCT_ID="9657946210548";
export type CheckoutVariant={id:string;title:string;size:string;available:boolean;amount:string;currency:string};
export type CheckoutProduct={id:string;title:string;url:string|null;variants:CheckoutVariant[]};
export type CheckoutStatus={productId:string;teamId:string;product:CheckoutProduct|null;adminProduct:{title:string;status:string;sizes:string[]}|null;tokenConfigured:boolean;ready:boolean;error:string|null};
export type CheckoutItem={teamId:string;size:string;quantity:number;config:TemplateConfig};
export type CheckoutResult={id:string;checkoutUrl:string;selections:{draftId:string;teamId:string;size:string}[]};
