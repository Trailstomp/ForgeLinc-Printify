import type {TemplateConfig} from "./catalog";
import {drawSculptedStripes} from "./stripe-sculpted";
export async function drawStripeLightning(c:CanvasRenderingContext2D,w:number,h:number,cfg:TemplateConfig,sleeve=false,flip=false){drawSculptedStripes(c,w,h,cfg,sleeve,flip);}
