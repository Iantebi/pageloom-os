import{Router}from"express";import{z}from"zod";import{israeliInvoiceDraftSchema,calculateIsraeliInvoice}from"@pageloom/core";import{requirePlatformOrRole,type AuthenticatedRequest}from"./auth.js";import{db}from"./firebase.js";

// Owner Workspace "Billing" section. Customers/invoices/payments already existed as read-only
// display data inside /admin/customers/:id (customer-admin-api.ts) — nothing ever wrote to those
// collections. This router adds the first real write path (create an invoice using the existing,
// previously-unused Israeli VAT calculator in @pageloom/core, then record payments against it) plus
// an org-wide read for the new cross-customer Billing page. Owner/admin only: financial data.
export const billingRouter=Router();
const org=z.string().min(1);
const financeRoles=["owner","admin"];

billingRouter.get("/billing/overview",async(req:AuthenticatedRequest,res)=>{
  try{
    const organizationId=org.parse(req.query.organizationId);
    if(await requirePlatformOrRole(req,res,organizationId,financeRoles)===undefined)return;
    const[customers,invoices,payments]=await Promise.all([
      db.collection(`organizations/${organizationId}/customers`).limit(500).get(),
      db.collection(`organizations/${organizationId}/invoices`).orderBy("createdAt","desc").limit(500).get(),
      db.collection(`organizations/${organizationId}/payments`).orderBy("createdAt","desc").limit(500).get(),
    ]);
    return res.json({data:{
      customers:customers.docs.map(doc=>({id:doc.id,...doc.data()})),
      invoices:invoices.docs.map(doc=>({id:doc.id,...doc.data()})),
      payments:payments.docs.map(doc=>({id:doc.id,...doc.data()})),
      // No subscriptions concept exists in this codebase yet (no schema, no recurring-billing
      // integration) — an explicit empty array here, not fabricated rows, so the UI can show a real
      // "not set up yet" state instead of pretending this is implemented.
      subscriptions:[],
    }});
  }catch(error){return res.status(400).json({error:{code:"BILLING_OVERVIEW_FAILED",message:error instanceof Error?error.message:"Could not load billing overview"}})}
});

billingRouter.post("/billing/invoices",async(req:AuthenticatedRequest,res)=>{
  try{
    const input=z.object({organizationId:org,draft:israeliInvoiceDraftSchema}).parse(req.body);
    if(await requirePlatformOrRole(req,res,input.organizationId,financeRoles)===undefined)return;
    const customer=await db.doc(`organizations/${input.organizationId}/customers/${input.draft.customerId}`).get();
    if(!customer.exists)return res.status(404).json({error:{code:"CUSTOMER_NOT_FOUND",message:"Customer not found"}});
    const totals=calculateIsraeliInvoice(input.draft),now=new Date().toISOString(),ref=db.collection(`organizations/${input.organizationId}/invoices`).doc();
    const number=`INV-${now.slice(0,10).replaceAll("-","")}-${ref.id.slice(0,6).toUpperCase()}`;
    await ref.create({id:ref.id,number,customerId:input.draft.customerId,projectId:input.draft.projectId??null,documentType:input.draft.documentType,lines:input.draft.lines,...totals,status:"open",paidAgorot:0,createdBy:req.user!.uid,createdAt:now,updatedAt:now});
    return res.status(201).json({data:{id:ref.id,number,...totals,status:"open"}});
  }catch(error){return res.status(400).json({error:{code:"INVOICE_CREATE_FAILED",message:error instanceof Error?error.message:"Could not create invoice"}})}
});

billingRouter.post("/billing/invoices/:invoiceId/payments",async(req:AuthenticatedRequest,res)=>{
  try{
    const input=z.object({organizationId:org,amountAgorot:z.number().int().positive(),method:z.enum(["bank_transfer","credit_card","cash","cheque","other"]),note:z.string().max(500).optional()}).parse(req.body),invoiceId=String(req.params.invoiceId);
    if(await requirePlatformOrRole(req,res,input.organizationId,financeRoles)===undefined)return;
    const invoiceRef=db.doc(`organizations/${input.organizationId}/invoices/${invoiceId}`);
    const now=new Date().toISOString(),paymentRef=db.collection(`organizations/${input.organizationId}/payments`).doc();
    const result=await db.runTransaction(async tx=>{
      const invoiceSnap=await tx.get(invoiceRef);
      if(!invoiceSnap.exists)return{notFound:true as const};
      const invoice=invoiceSnap.data()!,paidAgorot=Number(invoice.paidAgorot??0)+input.amountAgorot,totalAgorot=Number(invoice.totalAgorot??0),status=paidAgorot>=totalAgorot?"paid":"partial";
      tx.create(paymentRef,{id:paymentRef.id,invoiceId,customerId:invoice.customerId,amountAgorot:input.amountAgorot,method:input.method,note:input.note??null,createdBy:req.user!.uid,createdAt:now});
      tx.update(invoiceRef,{paidAgorot,status,updatedAt:now});
      return{notFound:false as const,status,paidAgorot,totalAgorot};
    });
    if(result.notFound)return res.status(404).json({error:{code:"INVOICE_NOT_FOUND",message:"Invoice not found"}});
    return res.status(201).json({data:{id:paymentRef.id,invoiceId,status:result.status,paidAgorot:result.paidAgorot,totalAgorot:result.totalAgorot}});
  }catch(error){return res.status(400).json({error:{code:"PAYMENT_CREATE_FAILED",message:error instanceof Error?error.message:"Could not record payment"}})}
});
