///<reference path="../node_modules/@types/node/index.d.ts"/>

import * as net from "net"
import * as crypto from "crypto";

import SSCrypto from "./Crypto/SSCrypto";
import { ISSCryptoMethod } from "./Crypto/ISSCryptoMethod";

class Socks5ToShadowsocksProxyServer {

    isListen: boolean = false;
    proxyServer: net.Server = null;

    readonly localPort: number;
    readonly targetHost: string;
    readonly targetPort: number;

    upload: number = 0;
    download: number = 0;

    constructor(localPort: number, targetHost: string, targetPort: number) {
        this.localPort = localPort;
        this.targetHost = targetHost;
        this.targetPort = targetPort;
    }

    listen() {
        this.proxyServer = net.createServer(this.onClientConnect.bind(this));
        this.proxyServer.listen(this.localPort, () => {
            this.isListen = true;
        });

        setInterval(function () {
            var uploadSpeed: number = this.upload / 1024;
            var downloadSpeed: number = this.download / 1024;
            this.upload   = 0;
            this.download = 0;
            console.log(`uploadSpeed: ${uploadSpeed.toFixed(0)}kb/s   downloadSpeed:${downloadSpeed.toFixed(0)}kb/s`);
        }.bind(this), 1000);
    }

    close() {
        this.proxyServer.close();
    }

    private onClientConnect(client: net.Socket) {

        var process = new ProxyProcess({
            targetHost: this.targetHost,
            targetPort: this.targetPort,
            clientSocket: client,
            encryptProcess: SSCrypto.createCryptoMethodObject("aes-256-cfb", "9VNNPzCkV4LcuGd"),

            agentMode: false,

            onConnect: (targetAddress: string) => {
                console.log("傻逼连接到:", targetAddress);
            },

            onClose: () => {
                console.log("傻逼断开了");
            },

            onError: (err: Error) => {
                console.log("傻逼爆炸了:", err.message);
            },

            onUploadTraffic: (traffic: number) => {
                this.upload += traffic;
            },

            onDownloadTraffic: (traffic: number) => {
                this.download += traffic;
            },
        });

    }

}

class ProxyProcess {

    readonly initTime: number = new Date().getTime();

    readonly clientSocket: net.Socket;
    readonly targetSocket: net.Socket;
    readonly clientIP: string;
    readonly clientPort: number;

    readonly isAgentMode: boolean = false;

    dataBuffer: Buffer = new Buffer([]);
    isConnectTarget: boolean = false;
    isClear: boolean = false;
    isFirstTraffic: boolean = true;
    targetAddress: string = "";

    socks5HandSetup: number = 0;

    private isClientFirstPackage: boolean = true;
    private isTargetFirstPackage: boolean = true;

    constructor(private processConfig: ProxyProcessConfig) {
        if (processConfig.agentMode != undefined) {
            this.isAgentMode = processConfig.agentMode;
        }
        this.clientSocket = processConfig.clientSocket;
        this.clientSocket.setNoDelay(false);
        this.clientSocket.on("data", this.isAgentMode ? this.onAgentModeClientSocketData.bind(this) : this.onClientSocketData.bind(this));
        this.clientSocket.on("close", this.onClientSocketClose.bind(this));
        this.clientSocket.on("error", this.onClientSocketError.bind(this));

        this.clientIP = this.clientSocket.address().address;
        this.clientPort = this.clientSocket.address().port;

        this.targetSocket = new net.Socket();
        this.targetSocket.setNoDelay(false);
        this.targetSocket.on("error", this.onTargetSocketError.bind(this));
        this.targetSocket.connect(this.processConfig.targetPort, this.processConfig.targetHost, this.onTargetSocketConnect.bind(this));
    }

    private onTargetSocketConnect() {
        this.targetSocket.on("data", this.isAgentMode ? this.onAgentModeTargetSocketData.bind(this) : this.onTargetSocketData.bind(this));
        this.targetSocket.on("close", this.onTargetSocketClose.bind(this));
        if (!this.isAgentMode) {
            this.targetSocket.write(new Buffer([0x05, 0x01, 0x00]));
        } else {
            this.targetSocket.write(this.dataBuffer);
            this.isConnectTarget = true;
            this.dataBuffer = null;
        }
    }

    private onAgentModeClientSocketData(data: Buffer) {
        if (this.isConnectTarget) {
            this.targetSocket.write(data);
        } else {
            this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
        }
    }

    private onAgentModeTargetSocketData(data: Buffer) {
        if (this.isTargetFirstPackage) {
            this.isTargetFirstPackage = false;
            console.log(this.processConfig.encryptProcess.decryptData(data).slice(0, 20));
        }
        this.clientSocket.write(data);
    }

    private onTargetSocketData(data: Buffer) {
        if (this.socks5HandSetup == 0) {
            if (data.length != 2 && data[0] != 0x05 && data[0] != 0x00) {
                console.log("不支持的Socks5协议");
                return this.clearConnect();
            }
            this.targetSocket.write(this.dataBuffer.slice(0, 4 + this.dataBuffer[4] + 2 + 1))
            this.dataBuffer = this.dataBuffer.slice(4 + this.dataBuffer[4] + 2 + 1);
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
            if (this.processConfig.onConnect) {
                this.processConfig.onConnect(this.targetAddress);
            }
            this.targetSocket.write(this.dataBuffer);
            this.dataBuffer = null;
            this.isConnectTarget = true;
            this.socks5HandSetup++;
            return;
        }

        if (this.isFirstTraffic) {
            this.isFirstTraffic = false;
        }

        // console.log("==Socks5==");
        // console.log(data.toString());
        // console.log("==========");

        if (this.processConfig.onUploadTraffic) {
            this.processConfig.onUploadTraffic(data.length);
        }

        data = this.processConfig.encryptProcess.encryptData(data);
        this.clientSocket.write(data);
    }

    private onClientSocketData(data: Buffer) {
        try {
            data = this.processConfig.encryptProcess.decryptData(data);
        } catch (error) {
            this.onClientSocketError(error);
            return;
        }
        if (this.isClientFirstPackage) {
            //data = data.slice(this.processConfig.encryptProcess.getEncryptConfig().ivLengrh);
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
            } else {
                return this.onClientSocketError(new Error(`${this.clientIP}:${this.clientPort} 发送了未知的数据包.`))
            }
            this.targetAddress = address + ":" + ((data[addressLength + 2] << 8) + data[addressLength + 3]);
            this.targetAddress = this.targetAddress.trim();
            data = Buffer.concat([new Buffer([0x05, 0x01, 0x00]), data]);
            this.isClientFirstPackage = false;
        }


        // console.log("==iPhone==");
        // console.log(data.toString());
        // console.log("==========");

        if (this.processConfig.onDownloadTraffic) {
            this.processConfig.onDownloadTraffic(data.length);
        }

        /*
            判断是否已经连接至Socks5服务器  
            -> 已连接则直接解密转发流量        
            -> 未连接则暂时存放队列            
        */
        if (this.isConnectTarget) {
            this.targetSocket.write(data);
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
        if (this.processConfig.onError) {
            this.processConfig.onError(error);
        }
        this.clearConnect();
    }

    private onTargetSocketError(error: Error) {
        if (this.processConfig.onError) {
            this.processConfig.onError(error);
        }
        this.clearConnect();
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
        if (this.processConfig.onClose && this.isConnectTarget && this.isAgentMode === false) {
            this.processConfig.onClose();
        }
    }
}

interface ProxyProcessConfig {
    targetHost: string;
    targetPort: number;
    clientSocket: net.Socket;
    encryptProcess: ISSCryptoMethod;

    /* Event */
    onConnect?: Function;
    onClose?: Function;
    onError?: Function;
    onUploadTraffic?: Function;
    onDownloadTraffic?: Function;

    /* Config */
    agentMode?: boolean;
}

// forward port 1500 to 192.168.0.250:60704
//var proxy = new Socks5ToShadowsocksProxyServer(4000, "192.168.0.250", 60704);
var proxy = new Socks5ToShadowsocksProxyServer(4000, "192.168.0.250", 22);
//var proxy = new Socks5ToShadowsocksProxyServer(4000, "127.0.0.1", 1080);
proxy.listen();