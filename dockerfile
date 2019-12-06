FROM node:8.16.2-alpine

ENV TIME_ZONE=Asia/Shanghai

ENV LOCAL_PORT=3389
ENV LOCAL_CIPHER=rc4-md5
ENV LOCAL_PASSWORD=123456
ENV SOCKS5_ADDR=127.0.0.1
ENV SOCKS5_PORT=1080

WORKDIR /app

COPY . /app

RUN npm install --registry=https://registry.npm.taobao.org && npm run build

EXPOSE 3389

CMD ["sh", "-c", "node build/example.js --localPort ${LOCAL_PORT} --localCipher ${LOCAL_CIPHER} --localPassword ${LOCAL_PASSWORD} --socks5Addr ${SOCKS5_ADDR} --socks5Port ${SOCKS5_PORT}"]