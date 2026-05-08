"use strict";

const { expect } = require("chai");
const Connection = require("./Connection.js");

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const okResponse = (data = { result: 0, contents: {} }) => ({ data });
const tlsError = () => Object.assign(new Error("wrong version number"), { code: "EPROTO" });

function makeStub(urlMap) {
    const calls = [];
    const stub = async (url, body, opts) => {
        calls.push({ url, body, opts });
        const entry = Object.prototype.hasOwnProperty.call(urlMap, url) ? urlMap[url] : urlMap.default;
        if (entry === undefined) {
            throw new Error(`No stub for ${url}`);
        }
        if (entry instanceof Error) {
            throw entry;
        }
        if (typeof entry === "function") {
            return entry(url, body, opts);
        }
        return entry;
    };
    return { stub, calls };
}

describe("Connection", () => {
    describe("forced protocol", () => {
        it("uses HTTPS without discovery when protocol='https'", async () => {
            const { stub, calls } = makeStub({ default: okResponse() });
            const conn = new Connection("1.2.3.4", 51443, { logger: silentLogger, protocol: "https", post: stub });

            await conn.send("getDeviceInfo");

            expect(calls).to.have.length(1);
            expect(calls[0].url).to.equal("https://1.2.3.4:51443/beaver/command/getDeviceInfo");
            expect(conn.protocol).to.equal("https");
        });

        it("uses HTTP without discovery when protocol='http'", async () => {
            const { stub, calls } = makeStub({ default: okResponse() });
            const conn = new Connection("1.2.3.4", 51443, { logger: silentLogger, protocol: "http", post: stub });

            await conn.send("getDeviceInfo");

            expect(calls).to.have.length(1);
            expect(calls[0].url).to.equal("http://1.2.3.4:51443/beaver/command/getDeviceInfo");
            expect(conn.protocol).to.equal("http");
        });
    });

    describe("auto-discovery", () => {
        it("picks HTTPS on success and bypasses axios-retry on the probe", async () => {
            const { stub, calls } = makeStub({ default: okResponse() });
            const conn = new Connection("1.2.3.4", 51443, { logger: silentLogger, post: stub });

            await conn.send("getDeviceInfo");

            expect(conn.protocol).to.equal("https");
            // probe (with retries:0) + actual request
            expect(calls).to.have.length(2);
            expect(calls[0].url).to.match(/^https:/);
            expect(calls[0].opts["axios-retry"]).to.deep.equal({ retries: 0 });
            expect(calls[1].opts["axios-retry"]).to.equal(undefined);
        });

        it("falls back to HTTP when HTTPS probe rejects with TLS error", async () => {
            const { stub, calls } = makeStub({
                "https://1.2.3.4:51443/beaver/command/getDeviceInfo": tlsError(),
                default: okResponse(),
            });
            const conn = new Connection("1.2.3.4", 51443, { logger: silentLogger, post: stub });

            await conn.send("getDeviceInfo");

            expect(conn.protocol).to.equal("http");
            // HTTPS probe (fails) + HTTP probe (ok) + actual HTTP send
            expect(calls).to.have.length(3);
            expect(calls[0].url).to.match(/^https:/);
            expect(calls[1].url).to.match(/^http:/);
            expect(calls[2].url).to.match(/^http:/);
        });

        it("propagates the error when both HTTPS and HTTP fail", async () => {
            const httpErr = Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" });
            const { stub } = makeStub({
                "https://1.2.3.4:51443/beaver/command/getDeviceInfo": tlsError(),
                "http://1.2.3.4:51443/beaver/command/getDeviceInfo": httpErr,
            });
            const conn = new Connection("1.2.3.4", 51443, { logger: silentLogger, post: stub });

            let caught = null;
            try {
                await conn.send("getDeviceInfo");
            } catch (e) {
                caught = e;
            }

            expect(caught).to.equal(httpErr);
        });
    });

    describe("caching", () => {
        it("does not re-discover after a successful first call", async () => {
            const { stub, calls } = makeStub({ default: okResponse() });
            const conn = new Connection("1.2.3.4", 51443, { logger: silentLogger, post: stub });

            await conn.send("getDeviceInfo");
            await conn.send("getAirconStat", { airconId: "abc" });

            // first call: 1 probe + 1 actual; second call: 1 actual
            expect(calls).to.have.length(3);
            expect(conn.protocol).to.equal("https");
        });
    });

    describe("request body", () => {
        it("includes apiVer, command, deviceId, operatorId, timestamp; omits contents when not given", async () => {
            const { stub, calls } = makeStub({ default: okResponse() });
            const conn = new Connection("1.2.3.4", 51443, {
                logger: silentLogger,
                protocol: "https",
                operatorId: "op-x",
                deviceId: "dev-x",
                post: stub,
            });

            await conn.send("getDeviceInfo");

            const body = calls[0].body;
            expect(body.apiVer).to.equal("1.0");
            expect(body.command).to.equal("getDeviceInfo");
            expect(body.deviceId).to.equal("dev-x");
            expect(body.operatorId).to.equal("op-x");
            expect(body.timestamp).to.be.a("number");
            expect(body).to.not.have.property("contents");
        });

        it("includes contents when provided", async () => {
            const { stub, calls } = makeStub({ default: okResponse() });
            const conn = new Connection("1.2.3.4", 51443, {
                logger: silentLogger,
                protocol: "https",
                post: stub,
            });

            await conn.send("setAirconStat", { airconId: "abc", airconStat: "BLOB" });

            expect(calls[0].body.contents).to.deep.equal({ airconId: "abc", airconStat: "BLOB" });
        });
    });
});
