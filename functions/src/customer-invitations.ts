import {createHash} from "node:crypto";
import {db} from "./firebase.js";

type InvitationIdentity={uid:string;email?:string;emailVerified:boolean};
export function normalizeInvitationEmail(value:string){return value.trim().toLowerCase()}
export function invitationId(customerId:string,email:string){return createHash("sha256").update(`${customerId}:${normalizeInvitationEmail(email)}`).digest("hex")}
export function invitationExpiresAt(now=new Date()){return new Date(now.getTime()+7*24*60*60*1000).toISOString()}

export async function claimCustomerInvitations(identity:InvitationIdentity){
  if(!identity.email||!identity.emailVerified)return 0;
  const email=normalizeInvitationEmail(identity.email),now=new Date(),pending=await db.collectionGroup("customerInvitations").where("email","==",email).limit(20).get();
  let accepted=0;
  for(const invitation of pending.docs){
    if(invitation.data().status!=="pending"||new Date(String(invitation.data().expiresAt)).getTime()<=now.getTime())continue;
    const organization=invitation.ref.parent.parent;
    if(!organization)continue;
    await db.runTransaction(async transaction=>{
      const current=await transaction.get(invitation.ref);
      if(!current.exists||current.data()?.status!=="pending"||new Date(String(current.data()?.expiresAt)).getTime()<=now.getTime())return;
      const customerId=String(current.data()?.customerId??"");
      if(!customerId)return;
      transaction.set(organization.collection("members").doc(identity.uid),{uid:identity.uid,email,role:"client",customerId,projectIds:current.data()?.projectIds??[],websiteIds:current.data()?.websiteIds??[],permissions:current.data()?.permissions??{contentEdit:true,support:true,comments:true,assets:true},disabled:false,invitationId:invitation.id,joinedAt:now.toISOString(),updatedAt:now.toISOString()},{merge:true});
      transaction.update(invitation.ref,{status:"accepted",acceptedBy:identity.uid,acceptedAt:now.toISOString(),updatedAt:now.toISOString()});
      accepted++;
    });
  }
  return accepted;
}
