import type {Team,TemplateConfig} from "./catalog";
export type OrderArtwork={team:Team;config:TemplateConfig;size:string;quantity:number};
export type OrderLineReview={id:string;title:string;quantity:number;issue:string|null;artwork:OrderArtwork|null};
export type OrderReview={id:string;name:string;createdAt:string;test:boolean;payment:string;fulfillment:string;hold:string|null;url:string;lines:OrderLineReview[]};
export type OrderReviewPage={orders:OrderReview[];nextCursor:string|null;checkedAt:string;scanned:number};
