import * as crypto from "crypto";

import { ISSCryptoMethod } from "../ISSCryptoMethod";
import { ICryptoKeyIV } from "../ICryptoKeyIV";

import CryptoTools from "../CryptoTools";
import AESCryptoProcess from "./Share/AESCryptoProcess";

export default class AES256CFB implements ISSCryptoMethod {

    private readonly keyLength: number = 32;
    private readonly ivLength: number = 16;
    private readonly cryptoName: string = "aes-256-cfb";
    private readonly cryptoKeyIV: ICryptoKeyIV;
    private readonly cryptoProcess: AESCryptoProcess;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoKeyIV = CryptoTools.generateKeyIVByPassword(this.password, this.keyLength, this.ivLength);
        this.cryptoProcess = new AESCryptoProcess(this.cryptoName, this.cryptoKeyIV.key, this.cryptoKeyIV.iv )
    }

    encryptData(data: Buffer): Buffer {
        return this.cryptoProcess.encryptData(data);
    }

    decryptData(data: Buffer): Buffer {
        return this.cryptoProcess.decryptData(data);
    }
    
    getCryptoName(): string {
        return this.cryptoName;
    }
}


