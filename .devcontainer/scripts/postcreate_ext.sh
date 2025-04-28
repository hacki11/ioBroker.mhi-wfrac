#!/bin/bash

set -e

iob object set system.adapter.mhi-wfrac.0 native.interval=10
iob object set system.adapter.mhi-wfrac.0 native.devices=[{\"name\":\"Device1\"},{\"name\":\"Device2\"},{\"name\":\"Device3\"}]

iob object set system.adapter.mhi-wfrac.0 native.devices[0].ip=192.168.1.41
iob object set system.adapter.mhi-wfrac.0 native.devices[0].enabled=true

iob object set system.adapter.mhi-wfrac.0 native.devices[1].ip=192.168.1.42
iob object set system.adapter.mhi-wfrac.0 native.devices[1].enabled=false

iob object set system.adapter.mhi-wfrac.0 native.devices[2].ip=192.168.1.43
iob object set system.adapter.mhi-wfrac.0 native.devices[2].enabled=true