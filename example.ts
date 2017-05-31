///<reference path="./node_modules/@types/node/index.d.ts"/>

import Socks5SSProxy from "./src/Socks5SSProxy";
import Socks5SSProxyTcpProcess from "./src/Socks5SSProxyTcpProcess";

import SSCrypto from "./src/Crypto/SSCrypto";

/* listen port 3389 of Shadowsocks server and traffic forward to port 22 of Socks5 server. */
var proxy: Socks5SSProxy = new Socks5SSProxy(3389, "192.168.0.250", 9257, "rc4-md5", "123456");
var processes: Array<Socks5SSProxyTcpProcess> = [];

var upload: number = 0;
var download: number = 0;

setInterval(function () {
    var uploadSpeed: number = upload / 1024;
    var downloadSpeed: number = download / 1024;
    upload = 0;
    download = 0;
    console.log(`uploadSpeed: ${uploadSpeed.toFixed(0)}kb/s   downloadSpeed:${downloadSpeed.toFixed(0)}kb/s`);
}.bind(this), 1000);

proxy.on("clientConnected", (p: Socks5SSProxyTcpProcess) => {

    p.on("socks5Connected", () => {
        processes.push(p);
    });

    p.on("firstTraffic", (time: number) => {
        var remoteAddress: string = `${p.getRemoteAddress()}:${p.getRemotePort()}`;
        var clientAddress: string = `${p.getClientSocket().remoteAddress}:${p.getClientSocket().remotePort}`;
        console.log(`Client [${clientAddress}] connected to [${remoteAddress}]. Usage time: ${time}ms`);
    });

    p.on("socks5Data", (data: Buffer) => {
        upload += data.length;
    });

    var checkedAddress = false;
    p.on("clientData", (data: Buffer) => {

        if (!checkedAddress) {
            var addressBlockList: Array<string> = [
                "api.map.baidu.com",
                "ps.map.baidu.com",
                "sv.map.baidu.com",
                "offnavi.map.baidu.com",
                "newvector.map.baidu.com",
                "ulog.imap.baidu.com",
                "newloc.map.n.shifen.com",
            ];

            for (var address of addressBlockList) {
                if (address != p.getRemoteAddress()) {
                    continue;
                }
                var remoteAddress: string = `${p.getRemoteAddress()}:${p.getRemotePort()}`;
                var clientAddress: string = `${p.getClientSocket().remoteAddress}:${p.getClientSocket().remotePort}`;
                console.log(`Client [${clientAddress}] try to connect to [${remoteAddress}].`);
                return p.clearConnect();
            }
            checkedAddress = true;
        }
        /* 记录Shadowsocks客户端上行流量 */
        download += data.length;
    });

    p.on("close", () => {
        var index = processes.indexOf(p);
        if (index > -1) processes.splice(index, 1)
    });

    p.on("error", (err: Error) => {
        console.log(`Process Error:`, err.message);
    });
});

proxy.on("error", (err: Error) => {
    console.error("代理服务器出现错误:", err);
});

proxy.listen();
