# Socks5SSProxy
单Socks5转换成多用户(端口)Shadowsocks代理. 适用于使用中转加速的用户或中转SS服务商.

## 已支持的加密算法
* rc4-md5
* aes-192-cfb
* aes-256-cfb

> 如自行添加加密算法请实现`ISSCryptoMethod`接口
