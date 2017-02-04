import { ICryptoKeyIV } from "./ICryptoKeyIV";

export interface ISSCryptoMethod {
    encryptData(data: Buffer): Buffer;
    decryptData(data: Buffer): Buffer;
    getCryptoName(): string;
}

export type ISSCryptoConstructor = { 
    new(password: string): ISSCryptoMethod 
};
