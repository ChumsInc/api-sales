import { Decimal } from "decimal.js";
export function buildResult(rows, params) {
    return rows.map(row => {
        const p1_shipped = new Decimal(row.p1_shipped).add(params.openOrders ? row.p1_open : 0);
        const p1_sales = new Decimal(row.p1_sales).add(params.openOrders ? row.p1_open_sales : 0).sub(params.discounts ? row.p1_discount : 0);
        const p1_cogs = new Decimal(row.p1_cogs).add(params.openOrders ? row.p1_open_cogs : 0);
        const p1_revenue = p1_sales.sub(p1_cogs);
        const p1_margin = p1_sales.eq(0) ? new Decimal(0) : p1_revenue.div(p1_sales);
        const p2_shipped = new Decimal(row.p2_shipped).add(params.openOrders ? row.p2_open : 0);
        const p2_sales = new Decimal(row.p2_sales).add(params.openOrders ? row.p2_open_sales : 0).sub(params.discounts ? row.p2_discount : 0);
        const p2_cogs = new Decimal(row.p2_cogs).add(params.openOrders ? row.p2_open_cogs : 0);
        const p2_revenue = p2_sales.sub(p2_cogs);
        const p2_margin = p2_sales.eq(0) ? new Decimal(0) : p2_revenue.div(p2_sales);
        return {
            ...row,
            p1_shipped: p1_shipped.toString(),
            p1_sales: p1_sales.toString(),
            p1_cogs: p1_cogs.toString(),
            p1_revenue: p1_revenue.toString(),
            p1_margin: p1_margin.toString(),
            p2_shipped: p2_shipped.toString(),
            p2_sales: p2_sales.toString(),
            p2_cogs: p2_cogs.toString(),
            p2_revenue: p2_revenue.toString(),
            p2_margin: p2_margin.toString(),
        };
    });
}
