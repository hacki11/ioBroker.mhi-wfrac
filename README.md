![Logo](admin/mhi-wfrac.png)
# ioBroker.mhi-wfrac

[![NPM version](https://img.shields.io/npm/v/iobroker.mhi-wfrac.svg)](https://www.npmjs.com/package/iobroker.mhi-wfrac)
[![Downloads](https://img.shields.io/npm/dm/iobroker.mhi-wfrac.svg)](https://www.npmjs.com/package/iobroker.mhi-wfrac)
![Number of Installations](https://iobroker.live/badges/mhi-wfrac-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/mhi-wfrac-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.mhi-wfrac.png?downloads=true)](https://nodei.co/npm/iobroker.mhi-wfrac/)

**Tests:** ![Test and Release](https://github.com/hacki11/ioBroker.mhi-wfrac/workflows/Test%20and%20Release/badge.svg)

## mhi-wfrac adapter for ioBroker

Mitsubishi Heavy Industries Air Conditioners with WLAN Adapter WF-RAC

This Adapter integrates WF-RAC (Wifi) equipped Mitsubishi Heavy Industries Air Conditioners in ioBroker.

The code is based on 
- https://github.com/wolkeSoftware/ioBroker.woso_mitsu_aircon_rac
- https://github.com/W0w3/ioBroker.mhi_aircon 
- https://github.com/jeatheak/Mitsubishi-WF-RAC-Integration
- https://github.com/mcheijink/WF-RAC

Thank you very much for your work - It really helped me a lot.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
- (Diet1976) Fix: the configured retries (axios-retry) never happened - a single failed request set the device offline (#34)
- (Diet1976) Fix: devices unreachable at adapter start are registered later instead of missing until a restart
- (Diet1976) Fix: no unhandled rejection when a state of an unregistered device is written
- (Diet1976) Fix: an error while writing ioBroker states no longer marks the device offline
- (Diet1976) Fix: requests to one device are sent one after another (the module handles only one connection)

### 2.3.0 (2026-07-07)
- (copilot) Adapter requires node.js >= 22 now
- (hacki11) Add support for WF-RAC firmware v200
- (hacki11) Maintenance work for repo checker warnings and project housekeeping

### 2.2.0 (2026-02-28)
* (hacki11) Update dependencies
* (hacki11) Update minimum node version
* (hacki11) Fix ioBroker issues

### 2.1.7 (2025-05-17)
* (hacki11) Set `online` to false on adapter shutdown

### 2.1.6 (2025-05-05)
* (hacki11) Fix: `swingUpDown` was not writeable

### 2.1.5 (2025-04-28)
* (hacki11) Fix: Errorhandler used undefined aircon channel
* (hacki11) Increased retry count to workaround hourly aircon resets

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
MIT License

Copyright (c) 2025-2026 hacki11  
Copyright (c) 2023 W0w3  
Copyright (c) 2023 wolkeSoftware

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
