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
