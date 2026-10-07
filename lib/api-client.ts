/** Browser API responses may be replaced by a sign-in or gateway HTML page. */
export class ApiResponseError extends Error {
 constructor(message:string,public readonly signInRequired=false){super(message);this.name="ApiResponseError";}
}
export function apiFetch(path:string,init:RequestInit={}){
 const headers=new Headers(init.headers);headers.set("Accept","application/json");
 return fetch(path,{...init,headers,credentials:"same-origin",cache:"no-store",redirect:"manual"});
}
export async function readApiJson<T>(response:Response,allowErrorBody=false):Promise<T>{
 const signIn=()=>new ApiResponseError("Your ForgeLinc session needs to be renewed. Sign in again, then retry. Your saved designs and uploaded panels are kept.",true);
 if(response.status===401||response.type==="opaqueredirect"||(response.status>=300&&response.status<400))throw signIn();
 const text=await response.text();
 if(/text\/html/i.test(response.headers.get("content-type")??"")||/^\s*</.test(text)){
  if(/signin-with-chatgpt|Continue with ChatGPT|Log in to access/i.test(text))throw signIn();
  throw new ApiResponseError("ForgeLinc received an error page instead of a response"+(response.status>=400?" (HTTP "+response.status+")":"")+". Retry this step; your saved design and completed uploads are kept.");
 }
 let data:unknown;
 try{data=JSON.parse(text);}catch{throw new ApiResponseError("ForgeLinc received an incomplete response. Retry this step; your saved design and completed uploads are kept.");}
 if(!response.ok&&!allowErrorBody){
  const error=data&&typeof data==="object"&&"error" in data&&typeof data.error==="string"?data.error:"The request could not finish. Please retry.";
  throw new ApiResponseError(error);
 }
 if(!data||typeof data!=="object")throw new ApiResponseError("ForgeLinc received an invalid response. Please retry this step.");
 return data as T;
}
