import * as crypto from "crypto";

export default class CryptoProcess {

    private isFirstEncryptData: boolean = true;
    private isFirstDecryptData: boolean = true;

    private encryptProcess: crypto.Cipher = null;
    private decryptProcess: crypto.Decipher = null;

    constructor(
        private cryptoName: string, 
        private KEY: any,
        private IV: any,
    ) {
  
    }

    encryptData(data: Buffer): Buffer {
        if (this.isFirstEncryptData) {
            this.isFirstEncryptData = false;
            this.encryptProcess = crypto.createCipheriv(this.cryptoName, this.KEY, this.IV);
            return Buffer.concat([this.IV, this.encryptProcess.update(data)]);
        }
        return this.encryptProcess.update(data);
    }

    decryptData(data: Buffer): Buffer {
        if (this.isFirstDecryptData) {
            this.isFirstDecryptData = false;
            var decryptIV: Buffer = data.slice(0, this.IV.length);
            this.decryptProcess = crypto.createDecipheriv(this.cryptoName, this.KEY, decryptIV);
            return this.decryptProcess.update(data.slice(this.IV.length));
        }
        return this.decryptProcess.update(data);
    }
}
