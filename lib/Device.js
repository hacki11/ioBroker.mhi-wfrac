"use strict";
const AirconStatClass = require("./AirconStat.js");
const AirconCoderClass = require("./AirconStatCoder.js");
const AIRCON_DEVICEID = "18547566-315b-4941-bb9b-90cedef4bbb7";

class Device {
    constructor(logger) {
        this.name = "";
        this.registered = false;
        this.airconStat = new AirconStatClass();
        this.airconAddress = "";
        this.deviceId = AIRCON_DEVICEID;
        this.airconId = "";
        this.airconMac = "";
        this.airconApMode = 0;
        this.firmwareVersion_wireless = "";
        this.firmwareVersion_mcu = "";
        this.firmwareType = "";
        this.connected_accounts = 0;
        this.name = "";
        this.lastError = "";
        this.autoHeating = 0;
        this.ledStat = 0;
        this.acCoder = new AirconCoderClass(logger);
    }
}

module.exports = Device;