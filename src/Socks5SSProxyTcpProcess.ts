import * as net from "net"
import * as crypto from "crypto";
import * as events from "events";

import SSCrypto from "./Crypto/SSCrypto";
import { ISSCryptoMethod } from "./Crypto/ISSCryptoMethod";

export default class Socks5SSProxyProcess extends events.EventEmitter {

    private readonly initTime: number = new Date().getTime();
    private firstTrafficTime: number = 0;

    private readonly clientSocket: net.Socket;
    private readonly targetSocket: net.Socket;

    private dataBuffer: Buffer = new Buffer([]);
    private isConnectTarget: boolean = false;
    private isClear: boolean = false;
    private isFirstTraffic: boolean = true;

    private remoteAddress: string = "";
    private remotePort: number = 0;
    private remoteAddressLength: number = 0;
    private remoteAddressType: "Unknow" | "IPv4" | "IPv6" | "Domain" = "Unknow";

    private socks5HandSetup: number = 0;

    private isClientFirstPackage: boolean = true;
    private isTargetFirstPackage: boolean = true;

    constructor(private processConfig: Socks5SSProxyProcessConfig) {
        super();
        this.clientSocket = processConfig.clientSocket;
        this.clientSocket.setNoDelay(false);
        this.clientSocket.on("data", this.onClientSocketData.bind(this));
        this.clientSocket.on("close", this.onClientSocketClose.bind(this));
        this.clientSocket.on("error", this.onClientSocketError.bind(this));

        this.targetSocket = new net.Socket();
        this.targetSocket.setNoDelay(true);
        this.targetSocket.on("error", this.onTargetSocketError.bind(this));
    }

    private onTargetSocketConnect() {
        this.targetSocket.on("data", this.onTargetSocketData.bind(this));
        this.targetSocket.on("close", this.onTargetSocketClose.bind(this));
        this.targetSocket.write(new Buffer([0x05, 0x01, 0x00]));
    }


    private onTargetSocketData(data: Buffer) {
        try {
            if (this.socks5HandSetup == 0) {
                if (data.length != 2 && data[0] != 0x05 && data[0] != 0x00) {
                    console.log("不支持的Socks5协议");
                    return this.clearConnect();
                }
                this.targetSocket.write(this.dataBuffer.slice(0, 4 + this.remoteAddressLength + 2));
                this.dataBuffer = this.dataBuffer.slice(4 + this.remoteAddressLength + 2);
                this.socks5HandSetup++;
                return;
            } else if (this.socks5HandSetup == 1) {
                if (data[1] != 0x00) {
                    return this.onTargetSocketError(new Error("Socks5握手失败 数据包:" + JSON.stringify(data)));
                }
                // console.log("Socks5握手成功");
                // console.log(this.dataBuffer.toString());
                this.isConnectTarget = true;
                this.targetSocket.write(this.dataBuffer);
                this.dataBuffer = null;
                this.emit("socks5Connected");
                this.socks5HandSetup++;
                return;
            }
        } catch (error) {
            console.error("Socks5握手失败", error);
            return this.clearConnect();
        }

        if (this.isFirstTraffic) {
            this.isFirstTraffic = false;
            /* 记录首次通讯时间 */
            this.firstTrafficTime = new Date().getTime();
            /* 触发首次通讯事件 */
            this.emit("firstTraffic", this.firstTrafficTime - this.initTime);
        }

        this.emit("socks5Data", data);

        if (this.isClear) return;

        data = this.processConfig.encryptMethod.encryptData(data);

        var self = this;
        self.targetSocket.pause();
        var bufferSize: number = this.clientSocket.bufferSize / 1024 / 1024;

        try {
            if (!self.clientSocket.writable) return;
            if (bufferSize >= 4) {
                self.clientSocket.write(data, function () {
                    bufferSize = self.clientSocket.bufferSize / 1024 / 1024;
                    if (self.targetSocket.isPaused() && bufferSize < 4) {
                        self.targetSocket.resume();
                    }
                });
            } else {
                self.clientSocket.write(data);
                self.targetSocket.resume();
            }
        } catch (err) {

        }
    }

    private onClientSocketData(data: Buffer) {
        try {
            data = this.processConfig.encryptMethod.decryptData(data);
            if (this.isClientFirstPackage) {
                if (data[0] == 0x03) {
                    this.remoteAddressType = "Domain";
                    this.remoteAddressLength = data[1] + 1;
                    this.remoteAddress = data.slice(2, this.remoteAddressLength + 1).toString();
                } else if (data[0] == 0x01) {
                    this.remoteAddressType = "IPv4";
                    this.remoteAddressLength = 4;
                    this.remoteAddress += data[1].toString() + ".";
                    this.remoteAddress += data[2].toString() + ".";
                    this.remoteAddress += data[3].toString() + ".";
                    this.remoteAddress += data[4].toString();
                } else if (data[0] == 0x04) {
                    this.remoteAddressType = "IPv6";
                    this.remoteAddressLength = 16
                    this.remoteAddress += data[1].toString() + ":";
                    this.remoteAddress += data[2].toString() + ":";
                    this.remoteAddress += data[3].toString() + ":";
                    this.remoteAddress += data[4].toString() + ":";
                    this.remoteAddress += data[5].toString() + ":";
                    this.remoteAddress += data[6].toString() + ":";
                    this.remoteAddress += data[7].toString() + ":";
                    this.remoteAddress += data[8].toString() + ":";
                    this.remoteAddress += data[9].toString() + ":";
                    this.remoteAddress += data[10].toString() + ":";
                    this.remoteAddress += data[11].toString() + ":";
                    this.remoteAddress += data[12].toString() + ":";
                    this.remoteAddress += data[13].toString() + ":";
                    this.remoteAddress += data[14].toString() + ":";
                    this.remoteAddress += data[15].toString() + ":";
                    this.remoteAddress += data[16].toString();
                } else {
                    this.onClientSocketError(new Error(`发送了未知地址类型数据包.`));
                    return;
                }
                this.remoteAddress = this.remoteAddress.trim();
                this.remotePort = ((data[this.remoteAddressLength + 1] << 8) + data[this.remoteAddressLength + 2]);
                if (isNaN(this.remotePort)) {
                    return this.onClientSocketError(new Error(`发送了未知端口数据包.`));
                }
                this.emit("clientHanded", this.remoteAddress, this.remotePort);
                if (this.isClear) return;
                data = Buffer.concat([new Buffer([0x05, 0x01, 0x00]), data]);
                this.isClientFirstPackage = false;
                this.targetSocket.connect(this.processConfig.targetPort, this.processConfig.targetHost, this.onTargetSocketConnect.bind(this));
            }
        } catch (error) {
            this.onClientSocketError(error);
            return;
        }

        this.emit("clientData", data);

        if (this.isClear) return;

        /*
            判断是否已经连接至Socks5服务器  
            -> 已连接则直接解密转发流量        
            -> 未连接则暂时存放队列            
        */
        if (this.isConnectTarget) {
            this.clientSocket.pause();
            this.targetSocket.write(data, function () {
                this.clientSocket.resume();
            }.bind(this));
        } else {
            this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
        }
    }

    private onClientSocketClose() {
        this.clearConnect();
    }

    private onTargetSocketClose() {
        this.clearConnect();
    }

    private onClientSocketError(error: Error) {
        this.emit("error", error);
        this.clearConnect();
    }

    private onTargetSocketError(error: Error) {
        this.emit("error", error);
        this.clearConnect();
    }

    public getRemoteAddress(): string {
        return this.remoteAddress;
    }

    public getRemoteAddressType(): "Unknow" | "IPv4" | "IPv6" | "Domain" {
        return this.remoteAddressType;
    }

    public getRemotePort(): number {
        return this.remotePort;
    }

    public getClientSocket(): net.Socket {
        return this.clientSocket;
    }

    public getTargetSocket(): net.Socket {
        return this.targetSocket;
    }

    public clearConnect() {
        if (this.isClear) {
            return;
        }
        this.isClear = true;
        try {
            this.targetSocket.destroy();
        } catch (ex) { }
        try {
            this.clientSocket.destroy();
        } catch (ex) { }
        this.dataBuffer = null;
        this.emit("close");
        this.removeAllListeners();
    }
}

export interface Socks5SSProxyProcessConfig {
    targetHost: string;
    targetPort: number;
    clientSocket: net.Socket;
    encryptMethod: ISSCryptoMethod;
}
