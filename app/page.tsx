import TeamShop from './team-shop';
import {getChatGPTUser} from './chatgpt-auth';
import {isStudioAdmin} from '@/lib/studio-access';
export const dynamic="force-dynamic";
export default async function Home(){
 const admin=isStudioAdmin(await getChatGPTUser());
 return <><TeamShop isAdmin={admin}/>{admin&&<a href="/catalog" style={{position:"fixed",right:18,bottom:18,zIndex:45,border:"1px solid #3f86c9",borderRadius:999,padding:"11px 16px",background:"#0b2742",color:"#fff",fontWeight:800,textDecoration:"none",boxShadow:"0 12px 34px rgba(0,0,0,.35)"}}>Catalog Builder</a>}</>;
}
