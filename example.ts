import Socks5SSProxy from "./src/Socks5SSProxy";
import Socks5SSProxyTcpProcess from "./src/Socks5SSProxyTcpProcess";

/* Socks5监听3389端口并将请求转换至192.168.0.250:9257Shadowsocks端口. */
var proxy: Socks5SSProxy = new Socks5SSProxy(3389, "192.168.0.250", 9257, "rc4-md5", "123456");
var processes: Array<Socks5SSProxyTcpProcess> = [];

proxy.on("clientConnected", (p: Socks5SSProxyTcpProcess) => {

    p.on("socks5Connected", () => {
        processes.push(p);
    });

    p.on("firstTraffic", (time: number) => {
        var remoteAddress: string = `${p.getRemoteAddress()}:${p.getRemotePort()}`;
        var clientAddress: string = `${p.getClientSocket().remoteAddress}:${p.getClientSocket().remotePort}`;
        console.log(`Client [${clientAddress}] connected to [${remoteAddress}].`);
    });

    p.on("socks5Data", (data: Buffer) => {
        
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
