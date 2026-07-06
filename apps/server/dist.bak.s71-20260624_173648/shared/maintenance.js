"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMaintenance = getMaintenance;
exports.setMaintenance = setMaintenance;
let _maintenance = false;
function getMaintenance() {
    return _maintenance;
}
function setMaintenance(enable) {
    _maintenance = enable;
}
