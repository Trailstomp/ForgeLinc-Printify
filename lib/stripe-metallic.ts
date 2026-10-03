import type {TemplateConfig} from "./catalog";
import {drawSculptedStripes} from "./stripe-sculpted";
export const isMetallicStyle=(style:TemplateConfig["stripeStyle"])=>style==="twist"||style==="blade-bolts";
export async function drawMetallicStripes(c:CanvasRenderingContext2D,w:number,h:number,cfg:TemplateConfig,sleeve=false,flip=false){drawSculptedStripes(c,w,h,cfg,sleeve,flip);}
