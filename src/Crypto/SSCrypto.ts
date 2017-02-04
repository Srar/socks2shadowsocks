
import { ISSCryptoMethod } from "./ISSCryptoMethod";

import RC4MD5 from "./CryptoMethods/RC4MD5";
import AES192CFB from "./CryptoMethods/AES192CFB";
import AES256CFB from "./CryptoMethods/AES256CFB";

var cryptoMethods: { [methodName: string]: any } = { }

cryptoMethods[new RC4MD5().getCryptoName()] = RC4MD5;
cryptoMethods[new AES192CFB().getCryptoName()] = AES192CFB;
cryptoMethods[new AES256CFB().getCryptoName()] = AES256CFB;

export default class SSCrypto {

    static getAllCryptoMethods(): Array<String> {
        return Object.keys(cryptoMethods);
    }

    static createCryptoMethodObject(methodName: string, password: string): ISSCryptoMethod {
        if(!cryptoMethods[methodName]) {
            throw new Error(`Unknow [${methodName}] crypto method.`);
        }
        var obj = new cryptoMethods[methodName](password);
        return obj;
    }
}