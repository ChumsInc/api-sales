export interface ItemValidationRow {
    id: number;
    keyword: string;
    sellAs: number;
    ItemCode: string;
    status:1|0;
    ItemCodeDesc: string|null;
    ProductType: string|null;
    InactiveItem: string|null;
    ItemStatus: string|null;
    QuantityAvailable: number|string|null;
    TotalQuantityOnHand: number|string|null;
}

export interface ItemImageValidationRow {
    id: number;
    keyword: string;
    sellAs: number;
    ItemCode: string;
    status: 1|0;
    productImage: string|null;
    defaultColor: string;
    childItemCode: string|null;
    childColorCode: string|null;
    childActive: 1|0;
    childImageFilename: string|null;
}

export interface CategoryPageValidationRow {
    id: number;
    pageKeyword: string;
    itemTitle: string
    productKeyword: string;
    productStatus: 1|0;
    sellAs: number;
    itemCode: string;
}

export interface ProductCategoryPageValidationRow {
    id: number;
    keyword: string;
    ItemCode: string;
    sellAs: number;
    parentId: number;
    categoryPageId: number|null;
    pageKeyword: string|null;
    pageStatus: number|null;
    pageItemStatus: number|null;
}

export interface ProductMixValidationRow {
    productId: number;
    keyword: string;
    ItemCode: string;
    name: string|null;
    mixId: number;
    MixItemCode: string;
    ComponentItemCode: string|null;
    BillComponentItemCode: string|null;
    itemQuantity: string|number|null;
    QuantityPerBill: string|number|null;
    color_code: string|null;
    color_name: string|null;
}


export interface B2BHistoryUser {
    userId: number;
    email: string;
    name: string;
    company: string;
    userType: number;
}

export interface B2BHistoryUserAction {
    userId: number;
    action: string;
}

export interface B2BHistoryAction {
    action: string;
    CartName?: string;
    SalesOrderNo: string;
    ItemCode: string;
    QuantityOrdered: string|number;
    Comment: string|null;
    promo_code?: string;
    versionNo?: string;
    referrer?: string;
}

export interface B2BHistoryOrder {
    SalesOrderNo: string;
    OrderStatus: string;
    ARDivisionNo: string;
    CustomerNo: string;
    ShipToCode: string|null;
    BillToName: string;
    ShipToName: string;
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    SalespersonName: string|null;
    OrderDate: string;
    PromotedDate: string|null;
    ShipExpireDate: string;
    LastInvoiceDate: string|null;
    OrderTotal:number|string;
    users: B2BHistoryUser[];
    userActions: B2BHistoryUserAction[];
}
