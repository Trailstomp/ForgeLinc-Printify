import TeamShop from './team-shop';
import {getChatGPTUser} from './chatgpt-auth';
import {isStudioAdmin} from '@/lib/studio-access';
export const dynamic="force-dynamic";
export default async function Home(){return <TeamShop isAdmin={isStudioAdmin(await getChatGPTUser())}/>;}
