"use strict";

const axios = require("axios");
const https = require("https");

const DEFAULT_OPERATOR_ID = "d2bc4571-1cea-4858-b0f2-34c18bef1901";
const DEFAULT_DEVICE_ID = "18547566-315b-4941-bb9b-90cedef4bbb7";
const PROBE_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 5000;

// Self-signed cert on a LAN device: trust on first use unless caller provides a custom agent.
const DEFAULT_HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

/**
 * Talks to one WF-RAC module. Auto-detects HTTP vs HTTPS on first use:
 *   - firmware v200 ("WF-RAC-HTTPS") only answers HTTPS
 *   - older firmware (v131, v140, …) answers either, per HA's empirical testing
 * The probe is HTTPS-first because v200 is the currently shipping firmware.
 */
class Connection {
    /**
     * @param {string} address
     * @param {number} port
     * @param {object} [options]
     * @param {object} [options.logger] ioBroker logger or console-compatible
     * @param {"auto"|"http"|"https"} [options.protocol="auto"]
     * @param {string} [options.operatorId]
     * @param {string} [options.deviceId]
     * @param {https.Agent} [options.httpsAgent]
     * @param {function} [options.post] axios.post-compatible; injectable for tests
     */
    constructor(address, port, options = {}) {
        this.address = address;
        this.port = port;
        this.logger = options.logger || console;
        this.operatorId = options.operatorId || DEFAULT_OPERATOR_ID;
        this.deviceId = options.deviceId || DEFAULT_DEVICE_ID;
        this.httpsAgent = options.httpsAgent || DEFAULT_HTTPS_AGENT;
        this._post = options.post || axios.post;
        this._discoveryPromise = null;
        const forced = options.protocol === "http" || options.protocol === "https" ? options.protocol : null;
        this._method = forced;
    }

    get protocol() {
        return this._method;
    }

    /**
     * @param {string} cmd
     * @param {object|string|null} [contents]
     * @returns {Promise<object>} parsed JSON response body
     */
    async send(cmd, contents) {
        await this._ensureDiscovered();
        return this._invoke(this._method, cmd, contents, this._requestOpts());
    }

    async _ensureDiscovered() {
        if (this._method) {
            return;
        }
        if (!this._discoveryPromise) {
            this._discoveryPromise = this._discover();
            // On rejection, clear so a later send() can probe again instead of permanently failing.
            this._discoveryPromise.catch(() => {
                this._discoveryPromise = null;
            });
        }
        this._method = await this._discoveryPromise;
    }

    async _discover() {
        try {
            await this._invoke("https", "getDeviceInfo", null, this._probeOpts());
            this.logger.info(`mhi-wfrac: ${this.address} speaks HTTPS`);
            return "https";
        } catch (e) {
            const reason = e && e.message ? e.message : String(e);
            this.logger.debug(`mhi-wfrac: HTTPS probe to ${this.address} failed (${reason}); trying HTTP`);
            await this._invoke("http", "getDeviceInfo", null, this._probeOpts());
            this.logger.info(`mhi-wfrac: ${this.address} speaks HTTP`);
            return "http";
        }
    }

    async _invoke(protocol, cmd, contents, opts) {
        const url = `${protocol}://${this.address}:${this.port}/beaver/command/${cmd}`;
        const body = this._buildBody(cmd, contents);
        this.logger.debug(`Connection._invoke | ${url} :: ${cmd}`);
        const response = await this._post(url, body, opts);
        return response.data;
    }

    _buildBody(cmd, contents) {
        const body = {
            apiVer: "1.0",
            command: cmd,
            deviceId: this.deviceId,
            operatorId: this.operatorId,
            timestamp: Math.floor(Date.now() / 1000),
        };
        if (contents !== null && contents !== undefined && contents !== "") {
            body.contents = contents;
        }
        return body;
    }

    _probeOpts() {
        return {
            timeout: PROBE_TIMEOUT_MS,
            httpsAgent: this.httpsAgent,
            // axios-retry reads per-request overrides; we want one shot during discovery,
            // otherwise the global retry policy adds ~30s of waiting before fallback.
            "axios-retry": { retries: 0 },
            headers: {
                Connection: "close",
                "Content-Type": "application/json;charset=UTF-8",
                accept: "application/json",
            },
        };
    }

    _requestOpts() {
        return {
            timeout: REQUEST_TIMEOUT_MS,
            httpsAgent: this.httpsAgent,
            headers: {
                Connection: "close",
                "Content-Type": "application/json;charset=UTF-8",
                "Access-Control-Allow-Origin": "*",
                accept: "application/json",
            },
        };
    }
}

module.exports = Connection;
module.exports.DEFAULT_OPERATOR_ID = DEFAULT_OPERATOR_ID;
module.exports.DEFAULT_DEVICE_ID = DEFAULT_DEVICE_ID;
