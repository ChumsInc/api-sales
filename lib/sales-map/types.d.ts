import type {StoreMapCustomer} from "chums-types";
import type {RowDataPacket} from "mysql2";

export type PublicStoreMapCustomer = Omit<StoreMapCustomer, 'Company'|'ARDivisionNo'|'CustomerNo'|
    'LastInvoice'|'reseller'|'ShipToCode'|'TelephoneNo'>
export type PublicStoreMapCustomerRow = PublicStoreMapCustomer & RowDataPacket;

export interface ExtendStoreMapCustomer extends StoreMapCustomer {
    lookupResult: string|null;
    LocationType: string|null;
    StoreType: string;
    valid: boolean;
}
export interface StoreMapCustomerRow extends RowDataPacket, Omit<ExtendStoreMapCustomer, 'latitude'|'longitude'|'distance'|'valid'> {
    latitude: number|string;
    longitude: number|string;
    distance: number|string;
    reseller: 'Y'|'N';
    valid: number;
}

export interface CustomerLookupAddress extends Pick<StoreMapCustomer, 'ARDivisionNo'|'CustomerNo'|'ShipToCode'|'CustomerName'
    |'AddressLine1'|'AddressLine2'|'AddressLine3'|'City'|'State'|'CountryCode'|'ZipCode'|'latitude'|'longitude'> {
    GoogleFormattedAddress: string|null;
    LocationType: string|null;
    lookupResult: string;
}
export interface CustomerLookupAddressRow extends RowDataPacket, Omit<CustomerLookupAddress, 'latitude'|'longitude'> {
    latitude: number|string;
    longitude: number|string;
}

export interface GoogleLookupAddress {
    ARDivisionNo:string;
    CustomerNo:string;
    ShipToCode:string|null;
    FullAddress:string;
    CityStateZip: string;
}
export type GoogleLookupAddressRow = GoogleLookupAddress & RowDataPacket;
