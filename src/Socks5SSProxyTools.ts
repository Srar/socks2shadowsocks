export default class Socks5SSProxyTools {
    
    static getAddressTypeAndAddressWithBuffer(data: Buffer): {
        port: number,
        address: string,
        addressLength: number,
        addressType: "Unknow" | "IPv4" | "IPv6" | "Domain",
    } {
        var port = 0;
        var address = "";
        var addressLength = 0;
        var addressType: "Unknow" | "IPv4" | "IPv6" | "Domain" = "Unknow";

        try {
            switch (data[0]) {
                case 0x03:
                    addressLength = data[1] + 1;
                    address = data.slice(2, addressLength).toString();
                    addressType = "Domain";
                    break;
                case 0x01:
                    addressLength = 4;
                    address += data[1].toString() + ".";
                    address += data[2].toString() + ".";
                    address += data[3].toString() + ".";
                    address += data[4].toString();
                    addressType = "IPv4";
                case 0x04:
                    addressLength = 16;
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
                    addressType = "IPv6";
                default:
                    throw "error";
            }
            port = ((data[addressLength + 1] << 8) + data[addressLength + 2]);
        } catch (error) {
            
        }

        return {
            port: port, 
            address: address,
            addressLength: addressLength,
            addressType: addressType
        };
    }
}
