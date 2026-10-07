// Normalize size aliases without ever substituting a different size.
export function sizeKey(value:string){
 const size=value.trim().toUpperCase().replace(/[\s-]/g,"");
 const aliases:Record<string,string>={XXL:"2XL",XXXL:"3XL",XXXXL:"4XL",XXXXXL:"5XL"};
 return aliases[size]??size;
}
export function sameSize(left:string,right:string){return sizeKey(left)===sizeKey(right);}
