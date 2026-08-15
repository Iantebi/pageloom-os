export function parseVerifiedDeploymentUrl(content:string){
  try{
    const value=JSON.parse(content)as{url?:unknown};
    if(typeof value.url!=="string")return;
    const url=new URL(value.url);
    return url.protocol==="https:"?url.toString():undefined;
  }catch{return}
}
