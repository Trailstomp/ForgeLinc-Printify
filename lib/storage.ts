import {env} from "cloudflare:workers";
export function database(){if(!env.DB)throw new Error("Draft storage is unavailable");return env.DB;}

