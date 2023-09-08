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
}
