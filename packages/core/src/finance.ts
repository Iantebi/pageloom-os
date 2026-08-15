import{z}from"zod";

export const moneySchema=z.number().finite().nonnegative();
export const financialEntrySchema=z.object({amount:moneySchema,currency:z.string().length(3).default("ILS"),occurredAt:z.string().datetime(),customerId:z.string().min(1).optional(),projectId:z.string().min(1).optional(),category:z.enum(["project","subscription","hosting","ai","domain","labor","software","tax","other"]),recurring:z.boolean().default(false)});
export type FinancialEntry=z.infer<typeof financialEntrySchema>;
export type ProjectFinance={id:string;customerId?:string;budget?:number;revenue?:number;cost?:number};
export type ExecutiveFinance={revenue:number;expenses:number;grossProfit:number;netProfit:number;mrr:number;arr:number;customerLifetimeValue:number;costPerCustomer:number;hostingCost:number;aiCost:number;domainCost:number;cashflow:number;projectProfitability:Record<string,number>};

export function calculateExecutiveFinance(input:{revenue:FinancialEntry[];expenses:FinancialEntry[];projects:ProjectFinance[];activeCustomers:number;averageCustomerLifetimeMonths?:number}):ExecutiveFinance{
  const revenue=input.revenue.reduce((sum,item)=>sum+item.amount,0),expenses=input.expenses.reduce((sum,item)=>sum+item.amount,0),mrr=input.revenue.filter(item=>item.recurring).reduce((sum,item)=>sum+item.amount,0),projectProfitability=Object.fromEntries(input.projects.map(project=>[project.id,Number(project.revenue??project.budget??0)-Number(project.cost??0)]));
  const by=(category:FinancialEntry["category"])=>input.expenses.filter(item=>item.category===category).reduce((sum,item)=>sum+item.amount,0),costPerCustomer=input.activeCustomers?expenses/input.activeCustomers:0;
  return{revenue,expenses,grossProfit:revenue-expenses,netProfit:revenue-expenses,mrr,arr:mrr*12,customerLifetimeValue:input.activeCustomers?mrr/input.activeCustomers*(input.averageCustomerLifetimeMonths??24):0,costPerCustomer,hostingCost:by("hosting"),aiCost:by("ai"),domainCost:by("domain"),cashflow:revenue-expenses,projectProfitability};
}
