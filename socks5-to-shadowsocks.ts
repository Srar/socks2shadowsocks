import * as net from "net"
import * as crypto from "crypto";

import Encrypt, { EncryptMethods, EncryptConfig } from "./Encrypt";

var traffic = 0;
var trafficCount = 0;
var connectionCount = 0;


var method_supported = {
    'aes-256-cfb': [32, 16],
    'rc4-md5': [16, 16]
};


var GenerateKeyIVByPasswordCache = {};

function GenerateKeyIVByPassword(passwordString: string, keyLength: number, ivLength: number): any {
    var password = new Buffer(passwordString, "binary");
    if (GenerateKeyIVByPasswordCache[`${password}:${keyLength}:${keyLength}`]) {
        return GenerateKeyIVByPasswordCache[`${password}:${keyLength}:${keyLength}`];
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
    GenerateKeyIVByPasswordCache[GenerateKeyIVByPasswordCache[`${password}:${keyLength}:${keyLength}`]] = [key, iv];
    console.log(key);
    return [key, iv];
}

var boom = method_supported["aes-256-cfb"];
// console.log(GenerateKeyIVByPassword("9VNNPzCkV4LcuGd", boom[0], boom[1]))



// setInterval(function () {
//     trafficCount += traffic;
//     var displ: string = "kb/s";
//     var speed: number = (traffic / 1024);
//     if (speed >= 1024) {
//         speed = speed / 1024;
//         speed = speed;
//         displ = "mb/s";
//     }
//     console.log(speed.toFixed(2), displ, (trafficCount / 1024 / 1024 / 1024).toFixed(3), "gb", connectionCount.toString());
//     traffic = 0;
// }, 1000);

class Socks5ToShadowsocksProxyServer {

    isListen: boolean = false;
    proxyServer: net.Server = null;

    readonly localPort: number;
    readonly targetHost: string;
    readonly targetPort: number;

    constructor(localPort: number, targetHost: string, targetPort: number) {
        this.localPort = localPort;
        this.targetHost = targetHost;
        this.targetPort = targetPort;
    }

    listen() {
        const server = net.createServer(this.onClientConnect.bind(this));
        server.listen(this.localPort, () => {
            this.isListen = true;
        });
    }

    onClientConnect(client: net.Socket) {
        connectionCount++;
        new ProxyClientProcess({
            targetHost: this.targetHost,
            targetPort: this.targetPort,
            clientSocket: client,
            onDone: () => {
                connectionCount--;
            },
            reportTraffic: (byte) => {
                traffic += byte;
            }
        });
    }

}

class ProxyClientProcess {

    readonly clientSocket: net.Socket;
    readonly targetSocket: net.Socket;
    readonly processConfig: ProxyClientProcessConfig;

    readonly clientIP: string;
    readonly clientPort: number;

    clientTraffic: number = 0;
    dataBuffer: Buffer = new Buffer([]);
    isConnectTarget: boolean = false;
    isClear: boolean = false;

    encryptProcess: Encrypt = new Encrypt("123", "aes-256-cfb");

    socks5HandSetup: number = 0;

    trafficCount: number = 0;

    isClientFirstPackage: boolean = true;
    isTargetFirstPackage: boolean = true;

    constructor(processConfig: ProxyClientProcessConfig) {
        this.processConfig = processConfig;
        this.clientSocket = processConfig.clientSocket;

        this.clientSocket.on("data", this.onClientSocketData.bind(this));
        this.clientSocket.on("close", this.onClientSocketClose.bind(this));
        this.clientSocket.on("error", this.onClientSocketError.bind(this));

        this.clientIP = this.clientSocket.address().address;
        this.clientPort = this.clientSocket.address().port;

        this.targetSocket = new net.Socket();
        this.targetSocket.setNoDelay(true);
        this.targetSocket.on("error", this.onTargetSocketError.bind(this));
        this.targetSocket.connect(this.processConfig.targetPort, this.processConfig.targetHost, this.onTargetSocketConnect.bind(this));
    }

    private onTargetSocketError(error: Error) {
        this.clearConnect();
        console.log("Target Socket Error:", error.message);
    }

    private onTargetSocketConnect() {
        console.log(`${this.clientIP}:${this.clientPort} -> proxy -> ${this.processConfig.targetHost}:${this.processConfig.targetPort}`);
        this.targetSocket.on("data", this.onTargetSocketData.bind(this));
        this.targetSocket.on("close", this.onTargetSocketClose.bind(this));
        this.targetSocket.write(new Buffer([0x05, 0x01, 0x00]));
    }

    private onTargetSocketData(data: Buffer) {
        if (this.socks5HandSetup == 0) {
            if (data.length != 2 && data[0] != 0x05 && data[0] != 0x00) {
                console.log("不支持的Socks5协议");
                return this.clearConnect();
            }
            console.log("Slice header:", this.dataBuffer.slice(0, 4 + this.dataBuffer[4] + 2 + 1));
            this.targetSocket.write(this.dataBuffer.slice(0, 4 + this.dataBuffer[4] + 2 + 1))
            this.dataBuffer = this.dataBuffer.slice(4 + this.dataBuffer[4] + 2 + 1);
            console.log("Slice body  :", this.dataBuffer);
            this.socks5HandSetup++;
            return;
        } else if (this.socks5HandSetup == 1) {
            if (data[1] != 0x00) {
                console.log("Socks5握手失败");
                console.log(data);
                return this.clearConnect();
            }
            // console.log("Socks5握手成功");
            // console.log(this.dataBuffer.toString());
            this.targetSocket.write(this.dataBuffer);
            this.dataBuffer = null;
            this.isConnectTarget = true;
            this.socks5HandSetup++;
            return;
        }

        // console.log("==Socks5==");
        // console.log(data.toString());
        // console.log("==========");

        this.clientTraffic += data.length;
        if (this.processConfig.reportTraffic) {
            this.processConfig.reportTraffic(this.clientTraffic);
            this.clientTraffic = 0;
        }

        data = this.encryptProcess.encryptData(data);
        this.clientSocket.write(data);
    }

    private onTargetSocketClose() {
        this.clearConnect();
        console.log("Target Socket Close");
    }

    private onClientSocketData(data: Buffer) {

        // if(trafficCount < 5) {
        //     console.log("iPhone: ", this.encryptProcess.decryptData(data).toString());
        //     trafficCount++;
        // }
        data = this.encryptProcess.decryptData(data);
        if (this.isClientFirstPackage) {
            //data = data.slice(this.encryptProcess.getEncryptConfig().ivLengrh);

            var address: string = "";
            var addressLength: number = 0;
            var addressType: "Unknow" | "IPv4" | "IPv6" | "Domain" = "Unknow";
            if (data[0] == 0x01) {
                addressType = "IPv4";
                addressLength = 4;
                address += data[1].toString() + ".";
                address += data[2].toString() + ".";
                address += data[3].toString() + ".";
                address += data[4].toString();
            } else if (data[0] == 0x03) {
                addressType = "Domain";
                addressLength = data[1];
                address = data.slice(1, addressLength + 2).toString();
            } else if (data[0] == 0x04) {
                addressType = "IPv6";
                addressLength = 16
                address += data[1].toString() + ":";
                address += data[2].toString() + ":";
                address += data[3].toString() + ":";
                address += data[4].toString() + ":";
                address += data[5].toString() + ":";
                address += data[6].toString() + ":";
                address += data[7].toString() + ":";
                address += data[8].toString() + ":";
                address += data[9].toString() + ":";
                address += data[10].toString() + ":";
                address += data[11].toString() + ":";
                address += data[12].toString() + ":";
                address += data[13].toString() + ":";
                address += data[14].toString() + ":";
                address += data[15].toString() + ":";
                address += data[16].toString();
                return;
            }

            console.log("address:", address + ":" + ((data[addressLength + 2] << 8) + data[addressLength + 3]));
            console.log("address length:", addressLength);
            data = Buffer.concat([new Buffer([0x05, 0x01, 0x00]), data]);
            this.isClientFirstPackage = false;
        }


        // console.log("==iPhone==");
        // console.log(data);
        // console.log("==========");

        this.clientTraffic += data.length;
        if (this.processConfig.reportTraffic) {
            this.processConfig.reportTraffic(this.clientTraffic);
            this.clientTraffic = 0;
        }
        if (this.isConnectTarget) {
            //this.targetSocket.write(data);
        } else {
            this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
        }
    }

    private onClientSocketClose() {
        this.clearConnect();
        console.log("Client Socket Close");
    }

    private onClientSocketError(error: Error) {
        this.clearConnect();
        console.log("Client Socket Error:", error.message);
    }

    public clearConnect() {
        if (this.isClear) {
            return;
        }
        this.isClear = true;
        if (this.isConnectTarget) {
            this.targetSocket.destroy();
        }
        this.clientSocket.destroy();
        this.dataBuffer = null;

        if (this.processConfig.onDone) {
            this.processConfig.onDone();
        }
    }
}

interface ProxyClientProcessConfig {
    targetHost: string;
    targetPort: number;
    clientSocket: net.Socket;

    onDone?: Function;
    reportTraffic?: Function;
}

// forward port 1500 to 192.168.0.250:60704
// var proxy = new Socks5ToShadowsocksProxyServer(4000, "192.168.0.250", 1084);
var proxy = new Socks5ToShadowsocksProxyServer(4000, "127.0.0.1", 1080);
proxy.listen();