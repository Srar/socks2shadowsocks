import * as crypto from "crypto";

import { ISSCryptoMethod } from "../ISSCryptoMethod";
import { ICryptoKeyIV } from "../ICryptoKeyIV";

import CryptoTools from "../CryptoTools";
import CryptoProcess from "../CryptoProcess";

export default class RC4MD5 implements ISSCryptoMethod {

    private readonly keyLength: number = 16;
    private readonly ivLength: number = 16;
    private readonly cryptoName: string = "rc4-md5";
    private readonly cryptoKeyIV: ICryptoKeyIV;
    private readonly cryptoProcess: CryptoProcess;

    constructor(private password?: string) {
        if (!password) {
            return;
        }
        this.cryptoKeyIV = CryptoTools.generateKeyIVByPassword(this.password, this.keyLength, this.ivLength);
        this.cryptoProcess = new CryptoProcess("rc4", this.cryptoKeyIV.key, "")
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


