import * as crypto from "crypto";

export default class Encrypt {

    password: string;
    encryptName: string;
    encryptConfig: EncryptConfig;

    cipher_iv: any;

    private GenerateKeyIVByPasswordCache = {};

    private encryptProcess: crypto.Cipher = null;
    private decryptProcess: crypto.Decipher = null;

    private KeyIV: EncryptKeyIVData = null;

    constructor(password: string, encryptName: string) {
        this.password = password;
        this.encryptName = encryptName;
        this.encryptConfig = EncryptMethods.getEncryptMethodConfig(encryptName);
        if (this.encryptConfig == undefined) {
            throw new Error(`Not found ${encryptName} encrypt method`);
        }
        this.KeyIV = this.generateKeyIVByPassword(this.password, this.encryptConfig.keyLength, this.encryptConfig.ivLengrh);;
    }

    getEncryptConfig(): EncryptConfig {
        return this.encryptConfig;
    }

    encryptData(data: Buffer): Buffer {
        if (this.encryptProcess == null) {
            this.encryptProcess = this.createEncryptProcess(this.KeyIV.iv);
            return Buffer.concat([this.KeyIV.iv, this.encryptProcess.update(data)]);
        }
        return this.encryptProcess.update(data);
    }

    decryptData(data: Buffer): Buffer {
        if (this.decryptProcess == null) {
            var decipher_iv_len: number = this.encryptConfig.ivLengrh;
            var decipher_iv: Buffer = data.slice(0, decipher_iv_len);
            this.decryptProcess = this.createDecryptProcess(decipher_iv);
            return this.decryptProcess.update(data.slice(decipher_iv_len));
        }
        return this.decryptProcess.update(data);
    }

    private createDecryptProcess(iv: Buffer): crypto.Decipher {
        if (iv == null) {
            iv = this.KeyIV.iv;
        }
        iv = iv.slice(0, this.encryptConfig.ivLengrh);
        return crypto.createDecipheriv(this.encryptName, this.KeyIV.key, iv);
    }

    private createEncryptProcess(iv: Buffer) {
        return crypto.createCipheriv(this.encryptName, this.KeyIV.key, iv);
    }

    public getKeyIVData(): EncryptKeyIVData {
        return this.KeyIV;
    }

    // private getCipher(op, iv): crypto.Decipher | crypto.Cipher {
    //     var encryptKeyIVData: EncryptKeyIVData = this.generateKeyIVByPassword(this.password, this.encryptConfig.keyLength, this.encryptConfig.ivLengrh);
    //     if (iv == null) {
    //         iv = encryptKeyIVData.iv;
    //     }
    //     if (op === 1) {
    //         this.cipher_iv = iv.slice(0, this.encryptConfig.ivLengrh);
    //     }
    //     iv = iv.slice(0, this.encryptConfig.ivLengrh);
    //     if (this.encryptConfig.getEncryptName() === 'rc4-md5') {
    //         //   /return create_rc4_md5_cipher(encryptKeyIVData.key, iv, op);
    //     } else {
    //         if (op === 1) {
    //             return crypto.createCipheriv(this.encryptConfig.getEncryptName(), encryptKeyIVData.key, iv);
    //         } else {
    //             return crypto.createDecipheriv(this.encryptConfig.getEncryptName(), encryptKeyIVData.key, iv);
    //         }
    //     }
    // }

    private generateKeyIVByPassword(passwordString: string, keyLength: number, ivLength: number): EncryptKeyIVData {
        var password = new Buffer(passwordString, "binary");
        if (this.GenerateKeyIVByPasswordCache[`${password}:${keyLength}:${keyLength}`] != undefined) {
            return this.GenerateKeyIVByPasswordCache[`${password}:${keyLength}:${keyLength}`];
        }
        var hashBuffers: Array<Buffer> = [];
        for (var dataCount = 0, loopCount = 0; dataCount < keyLength + ivLength; loopCount++) {
            var data: any = password;
            if (loopCount > 0) {
                data = Buffer.concat([hashBuffers[loopCount - 1], password]);
            }
            var md5 = crypto.createHash("md5");
            var md5Buffer = md5.update(data).digest();
            hashBuffers.push(md5Buffer);
            dataCount += md5Buffer.length;
        }
        var hashBuffer: Buffer = Buffer.concat(hashBuffers);
        var key: Buffer = hashBuffer.slice(0, keyLength);
        var iv: Buffer = hashBuffer.slice(keyLength, keyLength + ivLength);
        this.GenerateKeyIVByPasswordCache[this.GenerateKeyIVByPasswordCache[`${password}:${keyLength}:${keyLength}`]] = {
            key: key,
            iv: iv
        };
        return {
            key: key,
            iv: iv
        };
    }

}

export class EncryptMethods {

    private static encryptMethodsConfig: { [methodName: string]: EncryptConfig } = {
        "aes-128-cfb": { keyLength: 16, ivLengrh: 16 },
        "aes-192-cfb": { keyLength: 24, ivLengrh: 16 },
        "aes-256-cfb": { keyLength: 32, ivLengrh: 16 },
        "rc4-md5": { keyLength: 16, ivLengrh: 16 }
    }

    static getEncryptMethodConfig(methodName: string): EncryptConfig {
        return EncryptMethods.encryptMethodsConfig[methodName];
    }

    static getAllMethod(): Array<string> {
        return Object.keys(EncryptMethods.encryptMethodsConfig);
    }
}

export interface EncryptKeyIVData {
    key: Buffer
    iv: Buffer
};

export interface EncryptConfig {
    ivLengrh: number;
    keyLength: number;
}

