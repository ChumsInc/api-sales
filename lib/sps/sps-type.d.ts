export interface EDICustomer {
    id: number,
    Company: string,
    ARDivisionNo: string,
    CustomerNo: string,
    CustomerName: string,
    LookupFields: unknown,
    LookupValue: unknown,
    options: unknown,
}

export type CSVIndex = {
    _index: number,
}
export type FieldMap = {
    [key: string]: string,
}

export type CSVLine = CSVIndex & FieldMap;

export type ValidMapField = 'Customer'|'CancelDate'|'ItemCode'|'ShipExpireDate'|'ShipToCode'|'ShipVia';
export type MapField = ValidMapField |'';

export interface EDIMappingOption {
    add?: number,
    conversionFactor?: number,
    UOMOverride?: string,

}

export interface EDIMapping {
    id: number,
    MapField: MapField,
    CSVField: string,
    CustomerValue: string,
    MappedValue: string,
    MappedOptions: EDIMappingOption | null,
    changed?: boolean,
}

export interface EDIBillToAddress {
    CustomerName?: string,
    AddressLine1?: string,
    AddressLine2?: string,
    AddressLine3?: string,
    City?: string,
    State?: string,
    ZipCode?: string,
    CountryCode?: string,
}

export interface EDIShipToAddress {
    ShipToCode?: string,
    ShipToName?: string,
    ShipToAddress1?: string,
    ShipToAddress2?: string,
    ShipToAddress3?: string,
    ShipToCity?: string,
    ShipToState?: string,
    ShipToZipCode?: string,
    ShipToCountryCode?: string,
    WarehouseCode?: string,
}

export interface EDISalesOrderDetail {
    _index: number,
    VendorStyle: string,
    ItemCode: string,
    ItemCodeDesc: string,
    QuantityOrdered: number,
    UnitOfMeasure: string,
    UnitPrice: number,
    CommentText: string,
    UDF_SHIP_CODE: string|null,
    errors: string[],
    csv?: CSVLine,
    map?: EDIMapping,
}

export interface EDISalesOrderHeader {
    Company?: string,
    ARDivisionNo?: string,
    CustomerNo?: string,
    CustomerPONo?: string,
    ShipExpireDate?: string,
    CancelDate?: string,
    ShipToCode?: string,
    DropShip?: boolean,
    ShipVia?: string,
    comments?: string[],
    zeroCommissions?: boolean,
}

export interface EDISalesOrder extends EDISalesOrderHeader {
    BillToAddress?: EDIBillToAddress,
    ShipToAddress?: EDIShipToAddress,
    detail?: EDISalesOrderDetail[],
}
