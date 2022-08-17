/**
 * This should mirror chums-types/pricing.d.ts
 */

export type DBCompany = 'chums'|'bc';

export interface PriceLevel {
    PriceLevel: string;
    PriceLevelDescription: string;
    SortOrder: number;
    active:boolean;
    customers: number,
    priceCodes: number;
}

export interface BasePriceCode {
    Company: DBCompany;
    PriceCodeRecord: '0'|'1'|'2';
    PriceCode: string;
    PriceCodeDesc: string;
    BreakQuantity1: number,
    DiscountMarkup1: number,
    PricingMethod: 'C'|'D'|'M'|'O'|'P',
    DateUpdated: string;
}

export interface FullPriceCode extends BasePriceCode {
    CustomerPriceLevel: string,
    ItemCode: string;
    ARDivisionNo: string;
    CustomerNo: string;
    BreakQuantity1: number;
    BreakQuantity2: number;
    BreakQuantity3: number;
    BreakQuantity4: number;
    BreakQuantity5: number;
    DiscountMarkup1: number;
    DiscountMarkup2: number;
    DiscountMarkup3: number;
    DiscountMarkup4: number;
    DiscountMarkup5: number;
    DateCreated: string;
    UserCreatedKey: number;
    DateUpdated: string;
    UserUpdatedKey: string;
}

export interface BasePriceCodeInfo extends BasePriceCode {
    ItemsCount: number;
}

export interface CustomerPriceLevelPriceCode extends BasePriceCode {
    PriceCodeRecord: '0';
    CustomerPriceLevel: string,
}

export interface ItemPriceCode extends BasePriceCode {
    PriceCodeRecord: '1';
    ItemCode: string;
}

export interface CustomerPriceCode extends BasePriceCode {
    PriceCodeRecord: '2';
    ItemCode: string;
    ARDivisionNo: string;
    CustomerNo: string;
}


export interface PriceCodeChange extends BasePriceCode {
    CustomerPriceLevel: string,
    newDiscountMarkup1?: number,
    UserName?: string,
    timestamp?: string;
    hasChange:boolean;
}

export interface PriceCodeUser {
    id: number;
    UserName: string;
    email: string;
    changes: number;
}

export interface PriceCodeItem {
    ItemCode: string;
    ItemCodeDesc: string;
    ProductType: string;
    StandardUnitOfMeasure: string;
    StandardUnitPrice: number;
    SuggestedRetailPrice: number;
    AverageUnitCost: number;
}
