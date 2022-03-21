export interface AccountInvoice {
    Company: string,
    InvoiceNo: string,
    InvoiceType: string,
    InvoiceDate: string,
    CustomerPONo: string,
    SalesOrderNo: string,
    OrderType: string,
    ShipToCode: string,
    ShipToName: string,
    ShipToCity: string,
    ShipToState: string,
    ShipToZipCode: string,
    ShipToCountryCode: string,
    TaxableSalesAmt: number,
    NonTaxableSalesAmt: number,
    DiscountAmt: number,
    FreightAmt: number
}
