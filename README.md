# Socks5SSProxy
单Socks5转换成多用户(端口)Shadowsocks代理. 适用于使用中转加速的用户或中转SS服务商.

## 已支持的加密算法
* rc4-md5
* aes-192-cfb
* aes-256-cfb

> 如自行添加加密算法请实现`ISSCryptoMethod`接口


## 查询已支持的加密算法

```typescript
import SSCrypto from "./src/Crypto/SSCrypto";
/* SSCrypto.getAllCryptoMethods():List<string> 返回加密算法名数组 */
console.log(SSCrypto.getAllCryptoMethods());
```

## 创建一个Socks5转Shadowsocks代理

开始接受Shadowsocks客户端传入连接:

```typescript
import Socks5SSProxy from "./src/Socks5SSProxy";
import Socks5SSProxyProcess from "./src/Socks5SSProxyProcess";

/* 
    Shadowsocks服务端监听3389端口, 并将流量处理转发至192.168.0.250:22 Socks5服务端端口.
    Shadowsocks服务端所接受的算法:rc4-md5 密码: 123456
 */
var proxy: Socks5SSProxy = new Socks5SSProxy(3389, "192.168.0.250", 22, "rc4-md5", "123456");
proxy.on("error", (err: Error) => {
    console.error("代理服务器出现错误:", err);
});
proxy.listen();
```

> 如您想创建多个Shadowsocks服务端, 您只需要实例化多个`Socks5SSProxy`即可.

关闭全部Shadowsocks与Socks5连接并停止监听:

```typescript
proxy.close();
```

## Socks5转Shadowsocks服务事件

当您实例化`Socks5SSProxy`并调用`listen`方法后, 如有新连接传入则会触发`clientConnected`事件.

`clientConnected`事件会传给你一个`Socks5SSProxyProcess`实例.

`Socks5SSProxyProcess`为处理转发过程类您可以监听其事件来干一些破事.

事件列表:
* `socks5Connected`: Socks5连接并握手成功.
* `firstTraffic`: Shadowsocks客户端与Socks5服务端首次通讯. 返回`耗时(ms)`.
* `socks5Data`: Socks5服务端 -> Shadowsocks客户端 __已解密__ 数据.
* `clientData`: Shadowsocks客户端 -> Socks5服务端 __已解密__ 数据.
* `close`: Shadowsocks客户端或Socks5服务端关闭了连接.
* `error`: 转发过程中出现了错误. 返回`Error`.

使用:

```typescript
proxy.on("clientConnected", (p: Socks5SSProxyProcess) => {

    p.on("socks5Connected", () => {
        ...
    });

    p.on("firstTraffic", (time: number) => {
        var remoteAddress: string = `${p.getRemoteAddress()}:${p.getRemotePort()}`;
        var clientAddress: string = `${p.getClientSocket().address().address}:${p.getClientSocket().address().port}`;
        console.log(`Client [${clientAddress}] connected to [${remoteAddress}]. Usage time: ${time}ms`);
    });

    p.on("socks5Data", (data: Buffer) => {
        /*  记录Shadowsocks客户端下行流量
            如果您想判断这个连接是不是HTTP连接, 您针对首包可以使用:
            data.toString().indexOf("HTTP/1.1 ") != -1
            这样简易的方式来判断.
         */
        upload += data.length;
    });

    p.on("clientData", (data: Buffer) => {
        /* 记录Shadowsocks客户端上行流量 */
        download += data.length;
    });

    p.on("close", () => {
        ...
    });

    p.on("error", (err: Error) => {
        console.log(`Process Error:`, err.message);
    });
});

```

## Examples

* 屏蔽特定域名或IP
  ```typescript
    var checkedAddress = false;
    p.on("clientData", (data: Buffer) => {

        /* 避免多次判断造成性能下降 */
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
                var clientAddress: string = `${p.getClientSocket().address().address}:${p.getClientSocket().address().port}`;
                console.log(`Client [${clientAddress}] try to connect to [${remoteAddress}].`);
                return p.clearConnect();
            }
            checkedAddress = true;
        }
        /* 记录Shadowsocks客户端上行流量 */
        download += data.length;
    });
  ```