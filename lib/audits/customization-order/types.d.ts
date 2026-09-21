import {RowDataPacket} from "mysql2";

export type CustomizationMethod = 'screen-print' | 'dome' | 'sticker' | 'heat-transfer';

export interface CustomizationCategory {
    id: number;
    description: string;
    method: CustomizationMethod;
    active: boolean;
    categoryFees: CustomizationFee[];
    notes: string|null;
    minimumOrderQty: number | null;     // if set, then this is the minimum order qty for this category, otherwise it is the minimum order qty for the SKU
}

export interface CustomizationFee {
    itemCode: string;               // must match CI_Item.ItemCode, eg. /IM1
    minimumOrderQty: number | null; // if null or 0, then there is not a minimum order requirement
    quantityPerItem?: number;       // if not set, then defaults to 1 per item. Used for items that require multiple fees, eg. Cap Retainer 11106 which requires 2 domes per item
    fee: number;                    // fee per item, loaded from the CI_Item.StandardUnitPrice
    notes: string|null;
    enabled?: boolean;
    required?: boolean;
}

export interface CustomizationSKU {
    sku: string;                    // primary key, must be unique - will be matched against CI_Item.Category4
    categoryId: number;
    description: string|null;
    notes: string|null;
    placement: string|null;
    fees: CustomizationFee[];       // if set, these override the fees defined in the category
    itemCodes: string[];            // item code or regular expression for item code matching, if empty, then all item codes are included
    excludedItemCodes: string[];    // item code or regular expression for item code matching
    requiredItemCodes: string[];    // any required items must be included in the order if using this customization SKU
}

export interface CustomizationItem {
    itemCode: string;       // must match CI_Item.ItemCode, eg. /IM1
    validSKUs: string[];    // must match SKU in CustomizationSKU.sku
    notes: string|null;
    minimumOrderQty?: number;
}

export interface SalesOrderItem {
    itemCode: string;
    itemCodeDesc: string|null;
    sku: string;
    quantityOrdered: number|string;
    comment: string|null;
}

export interface CustomizationCodeDetail {
    section: string;
    customizationCode: string;
    quantityOrdered: number|string;
    customizationList: CustomizationOrderItem[];
    itemsOrdered: number|string|null;
    skuList: string[];
    itemList: SalesOrderItem[];
    lineKeyList: string[];
}

export interface CustomizationOrderItem {
    itemCode: string;
    itemCodeDesc: string|null;
    quantityOrdered: number|string;
    comment: string|null;
}

export type CustomizationCodeDetailRow  = CustomizationCodeDetail &  RowDataPacket

export interface CustomizedOrder {
    SalesOrderNo: string;
    CustomerKey: string;
    BillToName: string;
    OrderType: string;
    OrderStatus: string;
    OrderDate: string;
    ShipExpireDate: string;
    OrderTotal: number|string;
    CreatedBy: string;
    LastUpdatedBy: string;
    LastUpdated: string;
}

export interface SalesOrderMOQ {
    section: string;
    category: string;
    sku: string[];
    moq: number|string;
    customizationCodes: string[];
    quantityOrdered: number|string;
    skuList: Pick<SalesOrderItem, 'sku'|'quantityOrdered'>[]
}

export interface CardValidation {
    method: string;
    quantityItemsOrdered: number|string;
    quantityTagsOrdered: number|string;
}
