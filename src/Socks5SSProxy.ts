///<reference path="../node_modules/@types/node/index.d.ts"/>

import * as net from "net"
import * as crypto from "crypto";

import SSCrypto from "./Crypto/SSCrypto";
import { ISSCryptoMethod } from "./Crypto/ISSCryptoMethod";

import ProxyProcess, { ProxyProcessConfig } from "./Socks5SSProxyProcess";

class Socks5SSProxyServer {

    private readonly proxyServer: net.Server = null;

    isListen: boolean = false;
    upload: number = 0;
    download: number = 0;
    processes: Array<ProxyProcess> = [];

    constructor(
        private readonly localPort: number,
        private readonly targetHost: string,
        private readonly targetPort: number
    ) {
        this.proxyServer = net.createServer(this.onClientConnect.bind(this));
    }

    listen() {
        this.proxyServer.listen(this.localPort, () => {
            this.isListen = true;
        });

        setInterval(function() {
            console.log(this.processes.length);
        }.bind(this), 1000);

        // setInterval(function () {
        //     var uploadSpeed: number = this.upload / 1024;
        //     var downloadSpeed: number = this.download / 1024;
        //     this.upload   = 0;
        //     this.download = 0;
        //     console.log(`uploadSpeed: ${uploadSpeed.toFixed(0)}kb/s   downloadSpeed:${downloadSpeed.toFixed(0)}kb/s`);
        // }.bind(this), 1000);
    }

    close() {
        this.proxyServer.close();
        this.processes.forEach(process => process.clearConnect());
    }

    private onClientConnect(client: net.Socket) {

        var process = new ProxyProcess({
            targetHost: this.targetHost,
            targetPort: this.targetPort,
            clientSocket: client,
            encryptProcess: SSCrypto.createCryptoMethodObject("rc4-md5", "9VNNPzCkV4LcuGd"),

            onConnect: (targetAddress: string) => {
                this.processes.push(process);
                console.log("傻逼连接到:", targetAddress, this.processes.length);
            },

            onClose: () => {
                var index = this.processes.indexOf(process);
                if (index > -1) {
                    this.processes.splice(index, 1);
                }
                console.log("傻逼断开了", this.processes.length);
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

var proxy = new Socks5ToShadowsocksProxyServer(5000, "192.168.0.250", 22);
proxy.listen();